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
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
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
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
        <button
          onClick={() => {
            stopCameraStream();
            navigate('/');
          }}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-navy-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-navy-900 tracking-tight">
          {exercise?.name || 'Seated Knee Extension'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {exercise?.instructions ||
            'Sit upright in a chair with feet flat. Straighten your leg smoothly and lower it back down.'}
        </p>
      </div>

      {/* Camera Viewport & Overlays */}
      <Card className="p-2 sm:p-3 relative overflow-hidden bg-navy-950 text-white rounded-2xl shadow-md border-navy-800">
        <div className="relative aspect-[4/3] max-h-[55vh] sm:max-h-[500px] w-full rounded-xl overflow-hidden bg-navy-900 flex items-center justify-center">
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
            <div className="text-center p-6 space-y-3.5 z-10 max-w-sm mx-auto">
              <div className="w-14 h-14 rounded-full bg-navy-800 text-teal-calm mx-auto flex items-center justify-center border border-navy-700 shadow-inner">
                <Camera className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-base font-semibold text-white">
                  Exercise camera
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Position your device so your leg and chair are in view.
                </p>
              </div>

              {/* Privacy Notice */}
              <div className="bg-navy-900/90 border border-navy-700 rounded-xl p-2.5 text-left flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-300 leading-tight">
                  Camera stream runs privately on your device. No video is recorded or stored.
                </p>
              </div>

              <div className="pt-1 flex flex-col gap-2">
                <Button
                  fullWidth
                  variant="primary"
                  onClick={handleStartCamera}
                  icon={<Camera className="w-4 h-4" />}
                >
                  Start exercise
                </Button>
                <Button
                  fullWidth
                  size="sm"
                  variant="outline"
                  onClick={handleStartDemoMode}
                  className="text-slate-300 border-navy-700 hover:bg-navy-800"
                >
                  Practice without camera
                </Button>
              </div>
            </div>
          )}

          {/* Requesting Permission / Model Loading Spinner */}
          {(cameraStatus === 'requesting_permission' || modelStatus === 'loading') && (
            <div className="text-center p-6 space-y-3 z-10">
              <RefreshCw className="w-8 h-8 text-teal-calm animate-spin mx-auto" />
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {cameraStatus === 'requesting_permission'
                    ? 'Requesting Camera Permission...'
                    : 'Loading MediaPipe Pose Model...'}
                </h3>
                <p className="text-xs text-slate-muted max-w-xs mx-auto mt-1">
                  {cameraStatus === 'requesting_permission'
                    ? 'Please accept the camera permission in your browser.'
                    : 'Preparing on-device pose detection...'}
                </p>
              </div>
            </div>
          )}

          {/* Permission Denied UI */}
          {cameraStatus === 'permission_denied' && (
            <div className="text-center p-6 space-y-3 z-10 bg-navy-900/95 max-w-sm mx-auto">
              <div className="w-12 h-12 rounded-full bg-status-warning-bg text-status-warning mx-auto flex items-center justify-center">
                <VideoOff className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Camera Access Denied</h3>
                <p className="text-xs text-slate-muted mt-1 leading-relaxed">
                  {cameraErrorMessage}
                </p>
              </div>
              <div className="pt-2 flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleStartCamera}
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Retry Camera Permission
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStartDemoMode}
                  className="text-slate-300 border-navy-700"
                >
                  Use Guided Motion Mode
                </Button>
              </div>
            </div>
          )}

          {/* Camera Unavailable UI */}
          {cameraStatus === 'camera_unavailable' && (
            <div className="text-center p-6 space-y-3 z-10 bg-navy-900/95 max-w-sm mx-auto">
              <div className="w-12 h-12 rounded-full bg-rose-900/40 text-rose-400 mx-auto flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Camera Unavailable</h3>
                <p className="text-xs text-slate-muted mt-1 leading-relaxed">
                  {cameraErrorMessage}
                </p>
              </div>
              <div className="pt-2 flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleStartDemoMode}
                >
                  Continue in Guided Mode
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStartCamera}
                  className="text-slate-300 border-navy-700"
                >
                  Retry Device Detection
                </Button>
              </div>
            </div>
          )}

          {/* Model Loading Failure UI */}
          {modelStatus === 'failed' && (
            <div className="absolute top-3 left-3 right-3 bg-amber-900/80 border border-amber-600 rounded-lg p-2.5 text-xs text-amber-200 flex items-center justify-between z-20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
                <span>MediaPipe pose tracking unavailable. Running in guided motion mode.</span>
              </div>
              <Button size="sm" variant="outline" onClick={handleStartDemoMode} className="text-xs py-0.5 px-2 h-auto text-amber-100 border-amber-400">
                Acknowledge
              </Button>
            </div>
          )}

          {/* Live In-Session HUD Overlays */}
          {cameraStatus === 'active' && (
            <>
              {/* Top HUD bar */}
              <div className="absolute top-3 left-3 right-3 flex justify-between items-start pointer-events-none z-10">
                {/* Joint Angle Readout */}
                <div className="bg-navy-950/85 backdrop-blur-sm border border-navy-700/70 rounded-xl px-3 py-1.5 text-left shadow">
                  <p className="text-[10px] text-slate-subtle uppercase font-semibold">Knee Angle</p>
                  <p className="text-lg font-bold text-teal-calm">
                    {repState.currentAngle}°
                  </p>
                  <p className="text-[9px] text-slate-muted uppercase tracking-wider font-semibold">
                    {repState.phase.replace('_', ' ')}
                  </p>
                </div>

                {/* Rep Counter Readout */}
                <div className="bg-navy-950/85 backdrop-blur-sm border border-navy-700/70 rounded-xl px-3 py-1.5 text-center shadow">
                  <p className="text-[10px] text-slate-subtle uppercase font-semibold">Repetitions</p>
                  <p className="text-lg font-bold text-white">
                    <span className="text-teal-calm">{repState.repetitions}</span> / {repConfig.targetReps}
                  </p>
                </div>

                {/* Workout Timer */}
                <div className="bg-navy-950/85 backdrop-blur-sm border border-navy-700/70 rounded-xl px-3 py-1.5 text-right shadow">
                  <p className="text-[10px] text-slate-subtle uppercase font-semibold">Session Timer</p>
                  <p className="text-lg font-bold text-white font-mono">
                    {Math.floor(elapsedSeconds / 60)}:
                    {(elapsedSeconds % 60).toString().padStart(2, '0')}
                  </p>
                </div>
              </div>

              {/* Low Quality / No Pose Detection Warning */}
              {detectionQuality === 'no_pose' && !isManualDemoMode && (
                <div className="absolute top-16 left-3 right-3 bg-amber-950/90 border border-amber-600/70 rounded-xl px-3 py-2 text-center pointer-events-none z-10">
                  <p className="text-xs font-semibold text-amber-200 flex items-center justify-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>No person detected. Position chair 5–7 feet back with your leg visible.</span>
                  </p>
                </div>
              )}

              {/* Paused Overlay Badge */}
              {isPaused && (
                <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm flex items-center justify-center z-20">
                  <div className="bg-navy-900 border border-navy-700 rounded-2xl p-4 text-center space-y-2 shadow-2xl">
                    <Badge variant="warning" icon={<Pause className="w-3.5 h-3.5" />}>
                      Session Paused
                    </Badge>
                    <p className="text-xs text-slate-muted">Take a breath. Press resume when ready to continue.</p>
                  </div>
                </div>
              )}

              {/* Bottom Live Feedback Bar */}
              <div className="absolute bottom-3 left-3 right-3 bg-navy-950/90 backdrop-blur-sm border border-teal-calm/40 rounded-xl px-3.5 py-2 text-center pointer-events-none z-10">
                <p className="text-xs font-medium text-teal-light">
                  {repState.feedbackMessage}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Workout Control Bar */}
        {cameraStatus === 'active' && (
          <div className="mt-3 flex gap-2">
            {!isWorkoutActive ? (
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <Button
                  fullWidth
                  size="lg"
                  variant="primary"
                  onClick={handleStartWorkout}
                  icon={<Play className="w-5 h-5 fill-current" />}
                  className="flex-1"
                >
                  Start exercise
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    stopCameraStream();
                    setCameraStatus('idle');
                    setIsManualDemoMode(false);
                  }}
                  className="text-slate-300 border-navy-700 hover:bg-navy-800"
                >
                  Exit camera
                </Button>
              </div>
            ) : (
              <>
                {/* Pause / Resume Button */}
                {!isPaused ? (
                  <Button
                    variant="outline"
                    className="flex-1 text-slate-200 border-navy-700 hover:bg-navy-800"
                    onClick={handlePauseWorkout}
                    icon={<Pause className="w-4 h-4" />}
                  >
                    Pause
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={handleResumeWorkout}
                    icon={<Play className="w-4 h-4 fill-current" />}
                  >
                    Resume
                  </Button>
                )}

                {/* Finish Session Button */}
                <Button
                  variant="primary"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 border-none"
                  onClick={() => handleStopWorkout('completed')}
                  icon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Finish session
                </Button>
              </>
            )}
          </div>
        )}
      </Card>

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
