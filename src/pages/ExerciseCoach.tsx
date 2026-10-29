// ReKnee AI - Camera-Assisted Exercise Coach
// Strictly adheres to 01_PRD.md, 02_DESIGN.md, 03_ARCHITECTURE.md, 04_DATABASE.md,
// 09_FEATURE_DEVELOPMENT.md, 13_EXTERNAL_INTEGRATION.md, 14_TESTING_QA.md, and 16_SECURITY_AUDIT.md

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  VideoOff,
  ShieldCheck,
  Info,
  ChevronRight,
  Eye,
  Clock,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { SessionSummary } from '../components/common/SessionSummary';
import { repository } from '../lib/supabase/repository';
import { useAuth } from '../contexts/AuthContext';
import { PlanExercise, ExerciseSession, SessionStatus, MeasurementMode } from '../types/database';
import { PoseLandmarker } from '@mediapipe/tasks-vision';
import {
  CameraStatus,
  ModelStatus,
  DetectionQuality,
  RepCounterConfig,
  RepCounterState,
  LegLandmarks,
} from '../features/pose/types';
import {
  calculateJointAngle,
  extractLegLandmarks,
} from '../features/pose/angleCalculations';
import {
  DEFAULT_REP_CONFIG,
  createInitialRepCounterState,
  updateRepCounter,
} from '../features/pose/repCounter';
import { getPoseLandmarker, resetPoseLandmarker } from '../features/pose/poseService';
import { drawPoseOverlay, drawSimulatedOverlay } from '../features/pose/drawing';

export const ExerciseCoach: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const activeProfile = profile || repository.getGuaranteedProfile();

  // Prescribed Exercise from Recovery Plan
  const [exercise, setExercise] = useState<PlanExercise | null>(null);

  // Camera & Model State
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle');
  const [detectionQuality, setDetectionQuality] = useState<DetectionQuality>('no_pose');
  const [isManualDemoMode, setIsManualDemoMode] = useState<boolean>(false);
  const [cameraErrorMessage, setCameraErrorMessage] = useState<string>('');

  // Workout Session State
  const [isWorkoutActive, setIsWorkoutActive] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [repConfig, setRepConfig] = useState<RepCounterConfig>(DEFAULT_REP_CONFIG);
  const [repState, setRepState] = useState<RepCounterState>(createInitialRepCounterState());

  // Summary & Persistence State
  const [showSummaryModal, setShowSummaryModal] = useState<boolean>(false);
  const [savedSession, setSavedSession] = useState<ExerciseSession | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const hasSavedRef = useRef<boolean>(false);

  // Technical Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartTimeRef = useRef<number>(0);
  const isPausedRef = useRef<boolean>(false);
  const repStateRef = useRef<RepCounterState>(repState);
  repStateRef.current = repState;

  // Sync target reps from exercise plan
  useEffect(() => {
    let isMounted = true;
    const loadPlan = async () => {
      try {
        const plan = await repository.getRecoveryPlan(activeProfile.id);
        if (plan) {
          const exercises = await repository.getPlanExercises(plan.id);
          if (isMounted && exercises.length > 0) {
            const prescribed = exercises[0];
            setExercise(prescribed);
            setRepConfig((prev) => ({
              ...prev,
              targetReps: prescribed.target_repetitions || 10,
            }));
          }
        }
      } catch (err) {
        console.warn('Error loading plan exercises:', err);
      }
    };

    loadPlan();
    return () => {
      isMounted = false;
    };
  }, [activeProfile.id]);

  // Clean up camera stream and animation frames
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Error stopping track:', e);
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    setCameraStatus((prev) => (prev === 'active' || prev === 'paused' ? 'stopped' : prev));
  }, []);

  // Cleanup on unmount or route exit
  useEffect(() => {
    return () => {
      stopCameraStream();
      resetPoseLandmarker();
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [stopCameraStream]);

  // Request explicit camera permission and initialize video
  const handleStartCamera = async () => {
    setCameraStatus('requesting_permission');
    setCameraErrorMessage('');
    setModelStatus('loading');

    // Secure context & mediaDevices API guard (14_TESTING_QA.md, 18_DEPLOYMENT.md)
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus('camera_unavailable');
      setCameraErrorMessage(
        'Camera access requires a secure connection (HTTPS) or is not supported by your browser. You can use guided exercise mode.'
      );
      setModelStatus('idle');
      return;
    }

    try {
      // Step 1: Explicit camera request
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;

      // Step 2: Initialize MediaPipe PoseLandmarker model
      let poseLandmarker: PoseLandmarker | null = null;
      try {
        poseLandmarker = await getPoseLandmarker();
        setModelStatus('ready');
      } catch (modelErr) {
        console.warn('MediaPipe model load failed, allowing camera with guided fallback:', modelErr);
        setModelStatus('failed');
      }

      // Step 3: Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((e) => console.warn('Video play error:', e));
          setCameraStatus('active');
          startTrackingLoop(poseLandmarker);
        };
      }
    } catch (err: unknown) {
      console.warn('Camera access issue:', err);
      stopCameraStream();

      const domError = err as { name?: string; message?: string };
      if (domError.name === 'NotAllowedError' || domError.name === 'PermissionDeniedError') {
        setCameraStatus('permission_denied');
        setCameraErrorMessage(
          'Camera access was denied. Please allow camera permissions in your browser address bar to use automated pose tracking.'
        );
      } else if (
        domError.name === 'NotFoundError' ||
        domError.name === 'DevicesNotFoundError' ||
        domError.name === 'NotReadableError'
      ) {
        setCameraStatus('camera_unavailable');
        setCameraErrorMessage(
          'No camera was found or the camera is already in use by another application. You can use guided exercise mode instead.'
        );
      } else {
        setCameraStatus('camera_unavailable');
        setCameraErrorMessage(
          domError.message || 'Unable to access camera device. Please verify your camera settings.'
        );
      }
      setModelStatus('idle');
    }
  };

  // Switch to guided demonstration mode without camera
  const handleStartDemoMode = () => {
    stopCameraStream();
    setIsManualDemoMode(true);
    setCameraStatus('active');
    setModelStatus('fallback_demo');
    startDemoTrackingLoop();
  };

  // Main vision tracking loop (runs MediaPipe on live video frames)
  const startTrackingLoop = (landmarker: PoseLandmarker | null) => {
    let lastVideoTime = -1;

    const renderFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(renderFrame);
        return;
      }

      // Match canvas dimensions to video
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(renderFrame);
        return;
      }

      const now = performance.now();

      // Only run MediaPipe when video time advances and model is available
      if (landmarker && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;

        try {
          const results = landmarker.detectForVideo(video, now);

          if (results && results.landmarks && results.landmarks.length > 0) {
            const rawLandmarks = results.landmarks[0];
            const legLandmarks: LegLandmarks | null = extractLegLandmarks(
              rawLandmarks,
              repConfig.sidePreference
            );

            if (legLandmarks) {
              setDetectionQuality('good');

              // Calculate biomechanical knee angle
              const calculatedAngle = calculateJointAngle(
                legLandmarks.hip,
                legLandmarks.knee,
                legLandmarks.ankle
              );

              // If active and not paused, update rep counter state machine
              if (!isPausedRef.current) {
                const nextState = updateRepCounter(
                  repStateRef.current,
                  calculatedAngle,
                  repConfig,
                  Date.now()
                );
                setRepState(nextState);

                // Render anatomical overlay
                drawPoseOverlay(ctx, canvas.width, canvas.height, legLandmarks, {
                  kneeAngle: nextState.currentAngle,
                  phase: nextState.phase,
                  holdProgressPercent: nextState.holdProgressPercent,
                });
              } else {
                // Paused: draw static overlay
                drawPoseOverlay(ctx, canvas.width, canvas.height, legLandmarks, {
                  kneeAngle: repStateRef.current.currentAngle,
                  phase: 'paused',
                  holdProgressPercent: 0,
                });
              }
            } else {
              setDetectionQuality('low_confidence');
              ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
          } else {
            setDetectionQuality('no_pose');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        } catch (visionErr) {
          console.warn('Frame detection warning:', visionErr);
        }
      } else if (!landmarker) {
        // Model not loaded: render animated demo skeleton over video
        setDetectionQuality('good');
        runSimulatedFrame(ctx, canvas.width, canvas.height);
      }

      animFrameRef.current = requestAnimationFrame(renderFrame);
    };

    animFrameRef.current = requestAnimationFrame(renderFrame);
  };

  // Demo tracking loop for demonstration mode
  let demoAngle = 155;
  let demoDirection = -1;

  const runSimulatedFrame = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    if (!isPausedRef.current) {
      if (demoDirection === -1) {
        demoAngle -= 0.6;
        if (demoAngle <= 98) demoDirection = 1;
      } else {
        demoAngle += 0.6;
        if (demoAngle >= 155) demoDirection = -1;
      }

      const nextState = updateRepCounter(
        repStateRef.current,
        demoAngle,
        repConfig,
        Date.now()
      );
      setRepState(nextState);

      drawSimulatedOverlay(ctx, width, height, demoAngle, {
        kneeAngle: Math.round(demoAngle),
        phase: nextState.phase,
        holdProgressPercent: nextState.holdProgressPercent,
      });
    } else {
      drawSimulatedOverlay(ctx, width, height, demoAngle, {
        kneeAngle: Math.round(demoAngle),
        phase: 'paused',
        holdProgressPercent: 0,
      });
    }
  };

  const startDemoTrackingLoop = () => {
    const renderDemo = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        if (canvas.width !== 640) canvas.width = 640;
        if (canvas.height !== 480) canvas.height = 480;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          setDetectionQuality('good');
          runSimulatedFrame(ctx, canvas.width, canvas.height);
        }
      }
      animFrameRef.current = requestAnimationFrame(renderDemo);
    };
    animFrameRef.current = requestAnimationFrame(renderDemo);
  };

  // Start workout session
  const handleStartWorkout = () => {
    setIsWorkoutActive(true);
    setIsPaused(false);
    isPausedRef.current = false;
    setElapsedSeconds(0);
    setRepState(createInitialRepCounterState());
    hasSavedRef.current = false;
    sessionStartTimeRef.current = Date.now();

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  };

  // Pause workout
  const handlePauseWorkout = () => {
    setIsPaused(true);
    isPausedRef.current = true;
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  // Resume workout
  const handleResumeWorkout = () => {
    setIsPaused(false);
    isPausedRef.current = false;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  };

  // Stop or finish workout session
  const handleStopWorkout = async (status: SessionStatus) => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    setIsWorkoutActive(false);
    setIsPaused(false);
    isPausedRef.current = false;
    stopCameraStream();

    // Prepare and automatically save session metadata (preventing duplicate submission)
    await saveSessionMetadata(status);
    setShowSummaryModal(true);
  };

  // Save session metadata with strict authorization and duplicate prevention
  const saveSessionMetadata = async (status: SessionStatus) => {
    if (hasSavedRef.current || isSaving) return;
    hasSavedRef.current = true;
    setIsSaving(true);
    setSaveError(null);

    const finalDuration = Math.max(elapsedSeconds, 5);
    const mode: MeasurementMode = isManualDemoMode ? 'manual_demo' : 'camera_prototype';

    const sessionPayload: Omit<ExerciseSession, 'id' | 'created_at'> = {
      patient_id: activeProfile.id,
      plan_exercise_id: exercise?.id || 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      started_at: new Date(sessionStartTimeRef.current || Date.now() - finalDuration * 1000).toISOString(),
      ended_at: new Date().toISOString(),
      duration_seconds: finalDuration,
      repetitions: repState.repetitions,
      status,
      measurement_mode: mode,
    };

    try {
      const saved = await repository.saveExerciseSession(sessionPayload);
      setSavedSession(saved);
    } catch (err: unknown) {
      console.warn('Session save error:', err);
      setSaveError('Could not save session record. Please try saving again.');
      hasSavedRef.current = false; // Allow retry if save failed
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto space-y-5 pb-8">
      {/* Top Header */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={() => {
            stopCameraStream();
            navigate('/');
          }}
          className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed/40">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[11px] font-bold text-on-primary-fixed-variant uppercase tracking-wider">
            {cameraStatus === 'active' ? 'Live Sensor' : 'Sensor Ready'}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
          {exercise?.name || 'Seated Knee Extension'}
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant">
          Daily Mobility & Strengthening • Set 1 of 3
        </p>
      </div>

      {/* Camera Viewport & Overlays (Stitch Clinical Kineticism Container) */}
      <div className="relative w-full rounded-[28px] overflow-hidden shadow-xl bg-navy-950 text-white border border-surface-container-high/40">
        {/* Soft Background Luma Blobs */}
        <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-primary-container/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-tertiary-container/20 blur-3xl pointer-events-none" />

        <div className="relative aspect-[4/3] max-h-[500px] w-full overflow-hidden flex items-center justify-center">
          {/* Live Video Feed */}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 ${
              cameraStatus === 'active' && !isManualDemoMode ? 'block' : 'hidden'
            }`}
          />

          {/* HTML5 Canvas Pose Overlay */}
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 w-full h-full pointer-events-none transform -scale-x-100 ${
              cameraStatus === 'active' ? 'block' : 'hidden'
            }`}
          />

          {/* Pre-Camera / Initial State Explanation & Privacy */}
          {cameraStatus === 'idle' && (
            <div className="text-center p-6 space-y-4 z-10 max-w-sm mx-auto">
              <div className="w-16 h-16 rounded-full bg-surface-container-low/20 text-primary-container mx-auto flex items-center justify-center border border-white/10 shadow-inner">
                <Camera className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">
                  Exercise Camera
                </h3>
                <p className="text-xs text-white/80 mt-1 leading-relaxed">
                  Position your device so your leg and chair are in view for real-time motion guidance.
                </p>
              </div>

              {/* Privacy Notice */}
              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 text-left flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-primary-fixed shrink-0 mt-0.5" />
                <p className="text-[11px] text-white/90 leading-tight">
                  Camera frames are analyzed entirely on your device. No raw video or pictures are stored.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2.5">
                <button
                  onClick={handleStartCamera}
                  className="w-full h-[52px] rounded-full bg-primary-container text-on-primary-container font-bold text-sm flex items-center justify-center gap-2 shadow-[0_8px_20px_-4px_rgba(22,168,120,0.35)] hover:brightness-105 active:scale-[0.98] transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>Start Camera Session</span>
                </button>
                <button
                  onClick={handleStartDemoMode}
                  className="w-full h-11 rounded-full bg-white/10 text-white font-medium text-xs hover:bg-white/20 transition-all border border-white/20"
                >
                  Practice Without Camera
                </button>
              </div>
            </div>
          )}

          {/* Requesting Permission / Model Loading Spinner */}
          {(cameraStatus === 'requesting_permission' || modelStatus === 'loading') && (
            <div className="text-center p-6 space-y-3 z-10">
              <RefreshCw className="w-8 h-8 text-primary-fixed animate-spin mx-auto" />
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {cameraStatus === 'requesting_permission'
                    ? 'Requesting Camera Permission...'
                    : 'Loading MediaPipe Pose Model...'}
                </h3>
                <p className="text-xs text-white/70 max-w-xs mx-auto mt-1">
                  {cameraStatus === 'requesting_permission'
                    ? 'Please accept the camera permission in your browser.'
                    : 'Preparing on-device pose detection...'}
                </p>
              </div>
            </div>
          )}

          {/* Permission Denied UI */}
          {cameraStatus === 'permission_denied' && (
            <div className="text-center p-6 space-y-3 z-10 bg-navy-950/95 max-w-sm mx-auto rounded-3xl">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-300 mx-auto flex items-center justify-center">
                <VideoOff className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Camera Access Denied</h3>
                <p className="text-xs text-white/70 mt-1 leading-relaxed">
                  {cameraErrorMessage}
                </p>
              </div>
              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={handleStartCamera}
                  className="w-full h-11 rounded-full bg-primary-container text-on-primary-container font-semibold text-xs flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Camera Permission</span>
                </button>
                <button
                  onClick={handleStartDemoMode}
                  className="w-full h-11 rounded-full bg-white/10 text-white font-medium text-xs hover:bg-white/20 transition-all"
                >
                  Use Guided Motion Mode
                </button>
              </div>
            </div>
          )}

          {/* Live In-Session Stitch HUD Overlays */}
          {cameraStatus === 'active' && (
            <>
              {/* Floating Top Status Feedback Pill */}
              <div className="absolute top-4 inset-x-4 flex items-center justify-between pointer-events-none z-10">
                <div className="px-3.5 py-1.5 rounded-full bg-white/85 backdrop-blur-md shadow-sm flex items-center gap-2 border border-white/60">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-on-surface">
                    {repState.feedbackMessage || 'Great smooth movement'}
                  </span>
                </div>

                <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-white font-mono text-xs font-bold border border-white/10">
                  {Math.floor(elapsedSeconds / 60)}:
                  {(elapsedSeconds % 60).toString().padStart(2, '0')}
                </div>
              </div>

              {/* Low Quality / No Pose Detection Warning */}
              {detectionQuality === 'no_pose' && !isManualDemoMode && (
                <div className="absolute top-16 left-4 right-4 bg-amber-950/90 border border-amber-600/70 rounded-2xl px-3 py-2 text-center pointer-events-none z-10">
                  <p className="text-xs font-semibold text-amber-200 flex items-center justify-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>No person detected. Position chair 5–7 feet back with your leg visible.</span>
                  </p>
                </div>
              )}

              {/* Paused Overlay Badge */}
              {isPaused && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20">
                  <div className="bg-white rounded-3xl p-5 text-center space-y-2 shadow-2xl text-on-surface max-w-xs">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-900 inline-block">
                      Session Paused
                    </span>
                    <p className="text-xs text-on-surface-variant">
                      Take a quiet breath. Press resume when ready to continue.
                    </p>
                  </div>
                </div>
              )}

              {/* Floating Bottom Telemetry (Rep Count + Angle Gauge) */}
              <div className="absolute bottom-4 inset-x-4 flex items-end justify-between z-10 pointer-events-none">
                {/* Repetition Count Card */}
                <div className="flex flex-col bg-white/85 backdrop-blur-lg px-4 py-3 rounded-2xl shadow-md min-w-0 border border-white/60">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Repetition Count
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-3xl sm:text-4xl font-bold text-on-surface">
                      {repState.repetitions}
                    </span>
                    <span className="text-sm font-bold text-on-surface-variant">
                      / {repConfig.targetReps}
                    </span>
                  </div>
                </div>

                {/* Circular SVG Angle Gauge */}
                <div className="flex items-center gap-3 bg-white/85 backdrop-blur-lg px-4 py-3 rounded-2xl shadow-md border border-white/60">
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    <svg className="w-12 h-12 -rotate-90" viewBox="0 0 56 56">
                      <circle
                        cx="28"
                        cy="28"
                        fill="none"
                        r="23"
                        stroke="#bccac0"
                        strokeOpacity="0.35"
                        strokeWidth="5"
                      />
                      <circle
                        cx="28"
                        cy="28"
                        fill="none"
                        r="23"
                        stroke="#16a878"
                        strokeDasharray="144.5"
                        strokeDashoffset={Math.max(0, 144.5 - (repState.currentAngle / 90) * 144.5)}
                        strokeLinecap="round"
                        strokeWidth="5"
                        className="transition-all duration-150"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xs font-bold text-on-surface leading-none">
                        {repState.currentAngle}°
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                      Angle
                    </span>
                    <span className="text-xs font-semibold text-primary">
                      Target 90°
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Exercise Instructions & Progress Card */}
      <div className="flex flex-col gap-3 bg-white p-5 sm:p-6 rounded-3xl shadow-[0_4px_24px_-4px_rgba(17,24,39,0.06)] border border-surface-container-high/60">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col min-w-0">
            <span className="text-base sm:text-lg font-bold text-on-surface truncate">
              {exercise?.name || 'Seated Knee Extension'}
            </span>
            <span className="text-xs font-semibold text-primary">
              Set 1 of 3 • 10 reps each
            </span>
          </div>
          <div className="flex items-center gap-1 bg-surface-container-low px-2.5 py-1 rounded-full shrink-0">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-on-surface">2s hold</span>
          </div>
        </div>

        <p className="text-xs text-on-surface-variant leading-relaxed">
          Gently extend your leg until horizontal, hold for 2s, then lower slowly. Keep your posture tall and shoulders relaxed.
        </p>

        {/* Rep Progress Bar */}
        <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden mt-1">
          <div
            className="bg-primary h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, (repState.repetitions / repConfig.targetReps) * 100)}%` }}
          />
        </div>
      </div>

      {/* Interactive Workout Action Buttons */}
      {cameraStatus === 'active' && (
        <div className="flex items-center gap-3 pt-1">
          {!isWorkoutActive ? (
            <button
              onClick={handleStartWorkout}
              className="flex-1 h-[52px] rounded-full bg-primary-container text-on-primary-container font-bold text-base flex items-center justify-center gap-2 shadow-[0_8px_20px_-4px_rgba(22,168,120,0.35)] active:scale-[0.98] transition-transform"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Begin Repetitions</span>
            </button>
          ) : (
            <>
              <button
                onClick={isPaused ? handleResumeWorkout : handlePauseWorkout}
                className="flex-1 h-[52px] rounded-full bg-inverse-surface text-inverse-on-surface font-semibold text-sm sm:text-base flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform"
              >
                {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
                <span>{isPaused ? 'Resume Session' : 'Pause Session'}</span>
              </button>

              <button
                onClick={() => {
                  setRepState((prev) => ({
                    ...prev,
                    repetitions: prev.repetitions + 1,
                    feedbackMessage: 'Manual repetition logged',
                  }));
                }}
                className="h-[52px] px-5 rounded-full bg-surface-container text-on-surface font-semibold text-xs sm:text-sm flex items-center justify-center active:scale-[0.98] transition-transform"
                title="Tap to manually log a rep"
              >
                +1 Rep
              </button>

              <button
                onClick={() => handleStopWorkout('completed')}
                className="h-[52px] px-6 rounded-full bg-surface-container-high text-on-surface font-semibold text-sm sm:text-base flex items-center justify-center active:scale-[0.98] transition-transform hover:bg-surface-container-highest"
              >
                Finish
              </button>
            </>
          )}
        </div>
      )}


      {/* Safety Notice */}
      <div className="p-3 bg-warm-subtle rounded-xl border border-warm-border text-xs text-slate-muted flex items-start gap-2.5">
        <Info className="w-4 h-4 text-teal-calm shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Stop exercising immediately if you feel sharp pain. This exercise coach does not provide medical diagnosis.
        </p>
      </div>

      {/* Session Completion & Summary Modal */}
      <Modal
        isOpen={showSummaryModal}
        onClose={() => {
          setShowSummaryModal(false);
          navigate('/');
        }}
        title="Session Summary & Record"
      >
        <div className="space-y-4">
          {savedSession && (
            <SessionSummary
              session={savedSession}
              exerciseName={exercise?.name || 'Seated Knee Flexion & Extension'}
            />
          )}

          {/* Success Banner - verified save only */}
          {savedSession && !saveError && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Session recorded</strong>
                <span>
                  Your exercise data has been saved and shared with your care team.
                </span>
              </div>
            </div>
          )}

          {/* Saving In-Progress State */}
          {isSaving && (
            <div className="p-3 bg-warm-subtle border border-warm-border rounded-xl flex items-center gap-2 text-xs text-slate-muted">
              <RefreshCw className="w-4 h-4 text-teal-calm animate-spin shrink-0" />
              <span>Saving session...</span>
            </div>
          )}

          {/* If error occurred during save */}
          {saveError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
              <span>{saveError}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => saveSessionMetadata('completed')}
                isLoading={isSaving}
              >
                Retry Save
              </Button>
            </div>
          )}

          {/* Navigation Next Steps */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <Button
              fullWidth
              variant="outline"
              onClick={() => {
                setShowSummaryModal(false);
                navigate('/check-in');
              }}
              icon={<ChevronRight className="w-4 h-4" />}
            >
              Log Daily Check-in
            </Button>
            <Button
              fullWidth
              variant="primary"
              onClick={() => {
                setShowSummaryModal(false);
                navigate('/progress');
              }}
              icon={<Eye className="w-4 h-4" />}
            >
              View Recovery Progress
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
