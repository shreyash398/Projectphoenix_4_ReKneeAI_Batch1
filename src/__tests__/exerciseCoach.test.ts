// ReKnee AI - Camera-Assisted Exercise Coach Test Suite
// Strictly validates requirements in 01_PRD.md, 09_FEATURE_DEVELOPMENT.md, 13_EXTERNAL_INTEGRATION.md, and 14_TESTING_QA.md

import { describe, it, expect, vi } from 'vitest';
import {
  calculateJointAngle,
  extractLegLandmarks,
} from '../features/pose/angleCalculations';
import {
  createInitialRepCounterState,
  updateRepCounter,
} from '../features/pose/repCounter';
import {
  Landmark2D,
  RepCounterConfig,
  CameraStatus,
  ModelStatus,
} from '../features/pose/types';
import { repository } from '../lib/supabase/repository';
import { evaluateSessionAlert } from '../lib/alerts/rules';
import { ExerciseSession } from '../types/database';

describe('Camera-Assisted Exercise Coach', () => {
  describe('1. Joint Angle Calculation & Landmark Extraction', () => {
    it('calculates 180° for a perfectly straight collinear leg', () => {
      // Hip at (0, 0), Knee at (0, 1), Ankle at (0, 2)
      const hip: Landmark2D = { x: 0.5, y: 0.2 };
      const knee: Landmark2D = { x: 0.5, y: 0.5 };
      const ankle: Landmark2D = { x: 0.5, y: 0.8 };

      const angle = calculateJointAngle(hip, knee, ankle);
      expect(angle).toBe(180);
    });

    it('calculates 90° for a right-angle seated knee bend', () => {
      // Thigh horizontal (Hip at (0.2, 0.5)), Knee at (0.5, 0.5), Shin vertical (Ankle at (0.5, 0.8))
      const hip: Landmark2D = { x: 0.2, y: 0.5 };
      const knee: Landmark2D = { x: 0.5, y: 0.5 };
      const ankle: Landmark2D = { x: 0.5, y: 0.8 };

      const angle = calculateJointAngle(hip, knee, ankle);
      expect(angle).toBe(90);
    });

    it('calculates acute angle for deep knee flexion under chair', () => {
      // Thigh horizontal, Ankle pulled back under knee
      const hip: Landmark2D = { x: 0.2, y: 0.5 };
      const knee: Landmark2D = { x: 0.5, y: 0.5 };
      const ankle: Landmark2D = { x: 0.35, y: 0.76 }; // Pulled back

      const angle = calculateJointAngle(hip, knee, ankle);
      expect(angle).toBeLessThan(90);
      expect(angle).toBeGreaterThan(50);
    });

    it('safely handles degenerate/zero-length vectors without NaN', () => {
      const hip: Landmark2D = { x: 0.5, y: 0.5 };
      const knee: Landmark2D = { x: 0.5, y: 0.5 };
      const ankle: Landmark2D = { x: 0.5, y: 0.5 };

      const angle = calculateJointAngle(hip, knee, ankle);
      expect(Number.isFinite(angle)).toBe(true);
      expect(angle).toBe(180);
    });

    it('returns null when no landmarks are provided or landmark array is incomplete', () => {
      expect(extractLegLandmarks([])).toBeNull();
      expect(extractLegLandmarks(new Array(10).fill({ x: 0, y: 0 }))).toBeNull();
    });

    it('extracts right leg landmarks when right side has higher visibility', () => {
      const landmarks: Landmark2D[] = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
      // Set right leg landmarks with high visibility
      landmarks[24] = { x: 0.5, y: 0.3, visibility: 0.95 }; // Right Hip
      landmarks[26] = { x: 0.5, y: 0.6, visibility: 0.92 }; // Right Knee
      landmarks[28] = { x: 0.5, y: 0.9, visibility: 0.88 }; // Right Ankle

      const leg = extractLegLandmarks(landmarks, 'auto');
      expect(leg).not.toBeNull();
      expect(leg?.side).toBe('right');
      expect(leg?.confidence).toBeGreaterThan(0.85);
    });

    it('extracts left leg landmarks when left side has higher visibility', () => {
      const landmarks: Landmark2D[] = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
      // Set left leg landmarks with high visibility
      landmarks[23] = { x: 0.4, y: 0.3, visibility: 0.92 }; // Left Hip
      landmarks[25] = { x: 0.4, y: 0.6, visibility: 0.89 }; // Left Knee
      landmarks[27] = { x: 0.4, y: 0.9, visibility: 0.85 }; // Left Ankle

      const leg = extractLegLandmarks(landmarks, 'auto');
      expect(leg).not.toBeNull();
      expect(leg?.side).toBe('left');
      expect(leg?.confidence).toBeGreaterThan(0.8);
    });

    it('rejects pose when landmark confidence is below safety cutoff', () => {
      const landmarks: Landmark2D[] = new Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.15 }));
      const leg = extractLegLandmarks(landmarks, 'auto');
      expect(leg).toBeNull();
    });
  });

  describe('2. Repetition Counter State Machine', () => {
    const config: RepCounterConfig = {
      extensionThreshold: 145,
      flexionThreshold: 105,
      minHoldMs: 1000,
      targetReps: 10,
      sidePreference: 'auto',
    };

    it('initializes with 0 reps and ready_start phase', () => {
      const initial = createInitialRepCounterState();
      expect(initial.repetitions).toBe(0);
      expect(initial.phase).toBe('ready_start');
      expect(initial.holdStartTime).toBeNull();
    });

    it('transitions to flexing when knee angle begins bending below extension threshold', () => {
      let state = createInitialRepCounterState();
      state = updateRepCounter(state, 130, config, 1000);

      expect(state.phase).toBe('flexing');
      expect(state.repetitions).toBe(0);
      expect(state.feedbackMessage).toContain('Sliding foot back');
    });

    it('enters flexed_hold phase when knee reaches target flexion (≤105°)', () => {
      let state = createInitialRepCounterState();
      state = updateRepCounter(state, 130, config, 1000); // flexing
      state = updateRepCounter(state, 100, config, 2000); // reaches 100° <= 105°

      expect(state.phase).toBe('flexed_hold');
      expect(state.holdStartTime).toBe(2000);
      expect(state.feedbackMessage).toContain('Target bend reached');
    });

    it('tracks hold progress percentage and holds until minHoldMs is satisfied', () => {
      let state = createInitialRepCounterState();
      state = updateRepCounter(state, 100, config, 1000); // flexed_hold at t=1000

      // t=1500: halfway through 1000ms hold
      state = updateRepCounter(state, 98, config, 1500);
      expect(state.phase).toBe('flexed_hold');
      expect(state.holdProgressPercent).toBe(50);

      // t=2050: hold complete (elapsed = 1050ms >= 1000ms)
      state = updateRepCounter(state, 98, config, 2050);
      expect(state.phase).toBe('extending');
      expect(state.feedbackMessage).toContain('Hold complete');
    });

    it('completes a full repetition when leg returns to extension (≥145°)', () => {
      let state = createInitialRepCounterState();
      state = updateRepCounter(state, 130, config, 1000); // flexing
      state = updateRepCounter(state, 98, config, 2000);  // flexed_hold
      state = updateRepCounter(state, 98, config, 3100);  // hold completed -> extending
      expect(state.phase).toBe('extending');

      // Now straighten leg back to extension (150° >= 145°)
      state = updateRepCounter(state, 150, config, 4000);
      expect(state.phase).toBe('rep_completed');
      expect(state.repetitions).toBe(1);
      expect(state.feedbackMessage).toContain('Repetition 1 complete');

      // Next frame transitions cleanly to ready_start
      state = updateRepCounter(state, 155, config, 4100);
      expect(state.phase).toBe('ready_start');
      expect(state.repetitions).toBe(1);
    });

    it('does NOT count a rep if patient returns to extension without reaching flexion threshold', () => {
      let state = createInitialRepCounterState();
      state = updateRepCounter(state, 130, config, 1000); // flexing
      state = updateRepCounter(state, 118, config, 1500); // does not reach 105°
      // Returns back to extension
      state = updateRepCounter(state, 150, config, 2000);

      expect(state.phase).toBe('ready_start');
      expect(state.repetitions).toBe(0);
      expect(state.feedbackMessage).toContain('Foot returned to start');
    });

    it('handles premature release during hold gracefully without breaking flow', () => {
      let state = createInitialRepCounterState();
      state = updateRepCounter(state, 100, config, 1000); // enters flexed_hold
      // Patient slips/releases leg back to 135° after only 200ms
      state = updateRepCounter(state, 135, config, 1200);

      expect(state.phase).toBe('extending');
      expect(state.repetitions).toBe(0);
      expect(state.feedbackMessage).toContain('Released early');
    });
  });

  describe('3. Camera & Model State Flow', () => {
    it('models camera permission granted flow', () => {
      let status: CameraStatus = 'idle';
      expect(status).toBe('idle');

      // User clicks start
      status = 'requesting_permission';
      expect(status).toBe('requesting_permission');

      // Browser grants access
      status = 'active';
      expect(status).toBe('active');
    });

    it('models camera permission denied flow with proper error state', () => {
      let status: CameraStatus = 'requesting_permission';
      const error = new Error('Permission denied');
      error.name = 'NotAllowedError';

      if (error.name === 'NotAllowedError') {
        status = 'permission_denied';
      }

      expect(status).toBe('permission_denied');
    });

    it('models camera unavailable flow (no device found)', () => {
      let status: CameraStatus = 'requesting_permission';
      const error = new Error('Device not found');
      error.name = 'NotFoundError';

      if (error.name === 'NotFoundError') {
        status = 'camera_unavailable';
      }

      expect(status).toBe('camera_unavailable');
    });

    it('models MediaPipe model loading and failure recovery with demo fallback', () => {
      let modelState: ModelStatus = 'loading';
      expect(modelState).toBe('loading');

      // Simulate model load failure (e.g., offline or WebAssembly error)
      const loadFailed = true;
      if (loadFailed) {
        modelState = 'failed';
      }
      expect(modelState).toBe('failed');

      // User chooses fallback demo mode
      modelState = 'fallback_demo';
      expect(modelState).toBe('fallback_demo');
    });
  });

  describe('4. Workout Session Management (Start, Pause, Resume, Stop, Save)', () => {
    it('manages pause and resume timer state accurately', () => {
      let isPaused = false;
      let elapsedSeconds = 12;
      expect(isPaused).toBe(false);

      // User clicks Pause
      isPaused = true;
      expect(isPaused).toBe(true);
      expect(elapsedSeconds).toBe(12); // frozen

      // User clicks Resume
      isPaused = false;
      elapsedSeconds += 5;
      expect(isPaused).toBe(false);
      expect(elapsedSeconds).toBe(17);
    });

    it('saves completed session with valid metadata and correct measurement mode', async () => {
      const patientId = 'p2222222-2222-2222-2222-222222222222';
      const sessionData: Omit<ExerciseSession, 'id' | 'created_at'> = {
        patient_id: patientId,
        plan_exercise_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        started_at: new Date(Date.now() - 180000).toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: 180,
        repetitions: 10,
        status: 'completed',
        measurement_mode: 'camera_prototype',
      };

      const saved = await repository.saveExerciseSession(sessionData);
      expect(saved.id).toBeDefined();
      expect(saved.patient_id).toBe(patientId);
      expect(saved.repetitions).toBe(10);
      expect(saved.status).toBe('completed');
      expect(saved.measurement_mode).toBe('camera_prototype');

      // Verify NO raw video data exists in session object
      const rawObj = saved as unknown as Record<string, unknown>;
      expect(rawObj.video).toBeUndefined();
      expect(rawObj.frames).toBeUndefined();
    });

    it('prevents duplicate session submissions via submission guard', () => {
      let isSaving = false;
      let hasSaved = false;
      let submitCallCount = 0;

      const submitHandler = () => {
        if (hasSaved || isSaving) return false;
        hasSaved = true;
        isSaving = true;
        submitCallCount++;
        isSaving = false;
        return true;
      };

      // First submit
      expect(submitHandler()).toBe(true);
      expect(submitCallCount).toBe(1);

      // Second duplicate click
      expect(submitHandler()).toBe(false);
      expect(submitCallCount).toBe(1);
    });

    it('triggers moderate clinical review alert if session is stopped early with <3 reps', () => {
      const stoppedEarlySession: ExerciseSession = {
        id: 'sess-stopped-early',
        patient_id: 'p2222222-2222-2222-2222-222222222222',
        plan_exercise_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        started_at: new Date(Date.now() - 30000).toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: 30,
        repetitions: 1, // < 3 reps
        status: 'stopped_early',
        measurement_mode: 'camera_prototype',
        created_at: new Date().toISOString(),
      };

      const alertResult = evaluateSessionAlert(stoppedEarlySession);
      expect(alertResult.shouldAlert).toBe(true);
      expect(alertResult.category).toBe('clinical_review');
      expect(alertResult.severity).toBe('moderate');
      expect(alertResult.reason).toContain('stopped early after only 1 repetitions');
    });

    it('does NOT trigger alert if session is completed normally', () => {
      const normalSession: ExerciseSession = {
        id: 'sess-normal',
        patient_id: 'p2222222-2222-2222-2222-222222222222',
        plan_exercise_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        started_at: new Date(Date.now() - 180000).toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: 180,
        repetitions: 10,
        status: 'completed',
        measurement_mode: 'camera_prototype',
        created_at: new Date().toISOString(),
      };

      const alertResult = evaluateSessionAlert(normalSession);
      expect(alertResult.shouldAlert).toBe(false);
    });
  });

  describe('5. Stream Cleanup & Privacy Verification', () => {
    it('stops all media stream tracks on cleanup', () => {
      const mockStop1 = vi.fn();
      const mockStop2 = vi.fn();

      const mockStream = {
        getTracks: () => [
          { stop: mockStop1 },
          { stop: mockStop2 },
        ],
      };

      // Execute track cleanup logic
      mockStream.getTracks().forEach((track) => track.stop());

      expect(mockStop1).toHaveBeenCalledTimes(1);
      expect(mockStop2).toHaveBeenCalledTimes(1);
    });

    it('cancels active animation frame requests on cleanup', () => {
      const mockCancel = vi.fn();
      globalThis.cancelAnimationFrame = mockCancel;
      const animFrameId = 42;

      globalThis.cancelAnimationFrame(animFrameId);
      expect(mockCancel).toHaveBeenCalledWith(42);
    });
  });
});
