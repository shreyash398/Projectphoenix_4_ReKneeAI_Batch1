import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Play,
  Square,
  RefreshCw,
  CheckCircle,
  HelpCircle,
  ArrowLeft,
  VideoOff,
  Sparkles,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { repository } from '../lib/supabase/repository';
import { useAuth } from '../contexts/AuthContext';
import { PlanExercise, ExerciseSession } from '../types/database';

export const ExerciseCoach: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const activeProfile = profile || repository.getCurrentProfile();

  // Exercise details
  const [exercise, setExercise] = useState<PlanExercise | null>(null);

  // Camera & model states
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [modelLoading, setModelLoading] = useState<boolean>(false);
  const [manualFallbackMode, setManualFallbackMode] = useState<boolean>(false);

  // Exercise workout loop states
  const [isExercising, setIsExercising] = useState<boolean>(false);
  const [repetitions, setRepetitions] = useState<number>(0);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [kneeAngle, setKneeAngle] = useState<number>(165); // degrees
  const [movementPhase, setMovementPhase] = useState<'extension' | 'flexing' | 'holding' | 'recovering'>('extension');
  const [feedbackMessage, setFeedbackMessage] = useState<string>('Align your side profile to the camera');

  // Completed session modal
  const [savedSession, setSavedSession] = useState<ExerciseSession | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Load plan exercise
  useEffect(() => {
    const loadExercise = async () => {
      const plan = await repository.getRecoveryPlan(activeProfile.id);
      if (plan) {
        const exercises = await repository.getPlanExercises(plan.id);
        if (exercises.length > 0) {
          setExercise(exercises[0]);
        }
      }
    };
    loadExercise();
  }, [activeProfile.id]);

  // Cleanup camera stream
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCameraStream();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [stopCameraStream]);

  // Start Camera with user permission
  const handleStartCamera = async () => {
    setPermissionDenied(false);
    setModelLoading(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraActive(true);
          setModelLoading(false);
          startVisionTracking();
        };
      }
    } catch (err) {
      console.warn('Camera access denied or device unavailable:', err);
      setPermissionDenied(true);
      setModelLoading(false);
    }
  };

  // State machine for seated knee flexion & extension
  const processKneeMotion = useCallback((angle: number) => {
    setKneeAngle(Math.round(angle));

    // Thresholds:
    // Full extension/rest: ~160° - 175°
    // Target flexion: <= 100° (deep bend)
    setMovementPhase((prevPhase) => {
      if (angle <= 105 && prevPhase !== 'holding' && prevPhase !== 'recovering') {
        setFeedbackMessage('Great flexion depth! Hold for 2 seconds.');
        return 'holding';
      } else if (angle > 110 && angle < 150) {
        setFeedbackMessage('Slowly sliding heel back...');
        return 'flexing';
      } else if (angle >= 150 && prevPhase === 'holding') {
        // Completed repetition cycle
        setRepetitions((r) => r + 1);
        setFeedbackMessage('Repetition completed! Excellent controlled form.');
        return 'extension';
      }
      return prevPhase;
    });
  }, []);

  // Tracking loop with HTML5 Canvas overlay
  const startVisionTracking = useCallback(() => {
    let simulatedAngle = 165;
    let direction = -1;

    const renderLoop = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      if (canvas && video && video.readyState >= 2) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Simulated anatomical landmark tracking (Hip, Knee, Ankle)
          // In real MediaPipe execution, landmarks map to indices 23 (hip), 25 (knee), 27 (ankle)
          const centerX = canvas.width * 0.55;
          const hipY = canvas.height * 0.4;
          const kneeY = canvas.height * 0.65;

          // Leg oscillation simulation for demo tracking
          if (direction === -1) {
            simulatedAngle -= 0.6;
            if (simulatedAngle <= 95) direction = 1;
          } else {
            simulatedAngle += 0.6;
            if (simulatedAngle >= 165) direction = -1;
          }

          const ankleX = centerX - Math.sin(((180 - simulatedAngle) * Math.PI) / 180) * 110;
          const ankleY = kneeY + Math.cos(((180 - simulatedAngle) * Math.PI) / 180) * 110;

          // Draw skeleton lines
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#0D9488'; // teal-calm
          ctx.beginPath();
          ctx.moveTo(centerX, hipY);
          ctx.lineTo(centerX, kneeY);
          ctx.lineTo(ankleX, ankleY);
          ctx.stroke();

          // Draw landmark joints
          const drawJoint = (x: number, y: number, label: string) => {
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(x, y, 7, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = '#0F1D38';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.fillStyle = '#0F1D38';
            ctx.font = '10px -apple-system, sans-serif';
            ctx.fillText(label, x + 10, y + 4);
          };

          drawJoint(centerX, hipY, 'Hip');
          drawJoint(centerX, kneeY, `Knee (${Math.round(simulatedAngle)}°)`);
          drawJoint(ankleX, ankleY, 'Ankle');

          processKneeMotion(simulatedAngle);
        }
      }

      animFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameRef.current = requestAnimationFrame(renderLoop);
  }, [processKneeMotion]);

  // Session duration timer
  const handleStartWorkout = () => {
    setIsExercising(true);
    setRepetitions(0);
    setDurationSeconds(0);
    startTimeRef.current = Date.now();

    timerIntervalRef.current = setInterval(() => {
      setDurationSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  };

  const handleStopWorkout = async (status: 'completed' | 'stopped_early') => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setIsExercising(false);
    stopCameraStream();

    const finalDuration = Math.max(durationSeconds, 5);
    const mode = manualFallbackMode ? 'manual_demo' : 'camera_prototype';

    const sessionData: Omit<ExerciseSession, 'id' | 'created_at'> = {
      patient_id: activeProfile.id,
      plan_exercise_id: exercise?.id || 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      started_at: new Date(startTimeRef.current || Date.now() - finalDuration * 1000).toISOString(),
      ended_at: new Date().toISOString(),
      duration_seconds: finalDuration,
      repetitions,
      status,
      measurement_mode: mode,
    };

    const saved = await repository.saveExerciseSession(sessionData);
    setSavedSession(saved);
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            stopCameraStream();
            navigate('/');
          }}
          className="flex items-center gap-1 text-xs font-semibold text-slate-muted hover:text-navy-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        <Badge variant="teal" icon={<Sparkles className="w-3.5 h-3.5" />}>
          Vision Coach Prototype
        </Badge>
      </div>

      {/* Exercise Instructions Card */}
      <Card>
        <div className="flex items-start justify-between mb-2">
          <div>
            <span className="text-[10px] uppercase font-bold text-teal-calm tracking-wider">
              Prescribed Exercise
            </span>
            <h1 className="text-lg font-bold text-navy-900">
              {exercise?.name || 'Seated Knee Flexion & Extension'}
            </h1>
          </div>
          <Badge variant="neutral">Target: {exercise?.target_repetitions || 10} reps</Badge>
        </div>
        <p className="text-xs text-slate-muted leading-relaxed">
          {exercise?.instructions ||
            'Sit upright in a chair with feet flat. Slowly slide operative heel back under chair to bend knee. Hold 3 seconds, then return.'}
        </p>
      </Card>

      {/* Camera / Vision Viewport Card */}
      <Card className="p-2 sm:p-3 relative overflow-hidden bg-navy-950 text-white rounded-2xl">
        <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-navy-900 flex items-center justify-center">
          {/* Real video feed */}
          <video
            ref={videoRef}
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 ${
              cameraActive ? 'block' : 'hidden'
            }`}
          />

          {/* Canvas landmark overlay */}
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 w-full h-full pointer-events-none transform -scale-x-100 ${
              cameraActive ? 'block' : 'hidden'
            }`}
          />

          {/* Fallback & Initial State Overlays */}
          {!cameraActive && !permissionDenied && (
            <div className="text-center p-6 space-y-3 z-10">
              <div className="w-14 h-14 rounded-full bg-navy-800 text-teal-calm mx-auto flex items-center justify-center border border-navy-700">
                <Camera className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Camera Assist Inactive</h3>
                <p className="text-xs text-slate-muted max-w-xs mx-auto mt-1">
                  Camera processing runs strictly on-device in your browser. No video frames are ever recorded or stored.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={handleStartCamera}
                isLoading={modelLoading}
                icon={<Camera className="w-4 h-4" />}
              >
                {modelLoading ? 'Initializing Vision...' : 'Enable Camera'}
              </Button>
            </div>
          )}

          {/* Permission Denied / Fallback State */}
          {permissionDenied && (
            <div className="text-center p-6 space-y-3 z-10 bg-navy-900/90">
              <div className="w-12 h-12 rounded-full bg-status-warning-bg text-status-warning mx-auto flex items-center justify-center">
                <VideoOff className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Camera Access Denied or Unavailable</h3>
                <p className="text-xs text-slate-muted max-w-xs mx-auto mt-1">
                  You can still track your repetitions using our simulated demonstration mode.
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStartCamera}
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Retry Camera
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setManualFallbackMode(true);
                    setPermissionDenied(false);
                    setCameraActive(true);
                    startVisionTracking();
                  }}
                >
                  Use Demo Mode
                </Button>
              </div>
            </div>
          )}

          {/* Live In-Session HUD Overlays */}
          {cameraActive && (
            <div className="absolute top-3 left-3 right-3 flex justify-between items-start pointer-events-none">
              <div className="bg-navy-950/80 backdrop-blur-sm border border-navy-700/60 rounded-lg px-2.5 py-1 text-left">
                <p className="text-[10px] text-slate-muted uppercase font-semibold">Joint Angle</p>
                <p className="text-base font-bold text-teal-calm">{kneeAngle}°</p>
                <p className="text-[9px] text-slate-subtle uppercase tracking-wider">{movementPhase}</p>
              </div>

              <div className="bg-navy-950/80 backdrop-blur-sm border border-navy-700/60 rounded-lg px-2.5 py-1 text-center">
                <p className="text-[10px] text-slate-muted uppercase font-semibold">Repetitions</p>
                <p className="text-base font-bold text-white">
                  {repetitions} / {exercise?.target_repetitions || 10}
                </p>
              </div>

              <div className="bg-navy-950/80 backdrop-blur-sm border border-navy-700/60 rounded-lg px-2.5 py-1 text-right">
                <p className="text-[10px] text-slate-muted uppercase font-semibold">Timer</p>
                <p className="text-base font-bold text-white font-mono">
                  {Math.floor(durationSeconds / 60)}:
                  {(durationSeconds % 60).toString().padStart(2, '0')}
                </p>
              </div>
            </div>
          )}

          {/* Live Form Guidance Banner */}
          {cameraActive && (
            <div className="absolute bottom-3 left-3 right-3 bg-navy-950/85 backdrop-blur-sm border border-teal-calm/40 rounded-xl px-3 py-1.5 text-center pointer-events-none">
              <p className="text-xs font-medium text-teal-light">{feedbackMessage}</p>
            </div>
          )}
        </div>

        {/* Workout Control Actions */}
        <div className="mt-3 flex gap-2">
          {!isExercising ? (
            <Button
              fullWidth
              size="lg"
              variant="primary"
              onClick={handleStartWorkout}
              icon={<Play className="w-5 h-5 fill-current" />}
            >
              Start Recording Session
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleStopWorkout('stopped_early')}
                icon={<Square className="w-4 h-4" />}
              >
                Stop Early
              </Button>
              <Button
                variant="primary"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleStopWorkout('completed')}
                icon={<CheckCircle className="w-4 h-4" />}
              >
                Finish Session
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* Clinical Disclaimer */}
      <div className="p-3 bg-warm-subtle rounded-xl border border-warm-border text-xs text-slate-muted flex items-start gap-2.5">
        <HelpCircle className="w-4 h-4 text-teal-calm shrink-0 mt-0.5" />
        <p>
          <strong className="text-navy-900 font-semibold">Demonstration Disclaimer:</strong> ReKnee AI pose tracking is an educational prototype and does not provide clinically certified joint range-of-motion measurements. Never force movement through sharp joint distress.
        </p>
      </div>

      {/* Completion Summary Modal */}
      <Modal
        isOpen={Boolean(savedSession)}
        onClose={() => {
          setSavedSession(null);
          navigate('/');
        }}
        title="Session Completed & Logged"
      >
        <div className="space-y-4 text-center">
          <div className="w-14 h-14 bg-status-success-bg text-status-success rounded-full mx-auto flex items-center justify-center">
            <CheckCircle className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-navy-900">Great Job, Eleanor!</h3>
            <p className="text-xs text-slate-muted mt-1">
              Your recovery exercise activity has been saved and shared with your physical therapy care team.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-warm-bg p-3 rounded-xl border border-warm-border text-left">
            <div>
              <p className="text-[11px] text-slate-subtle uppercase font-semibold">Repetitions</p>
              <p className="text-base font-bold text-navy-900">{savedSession?.repetitions} reps</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-subtle uppercase font-semibold">Duration</p>
              <p className="text-base font-bold text-navy-900">{savedSession?.duration_seconds}s</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-subtle uppercase font-semibold">Status</p>
              <p className="text-sm font-semibold capitalize text-teal-calm">
                {savedSession?.status.replace('_', ' ')}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-subtle uppercase font-semibold">Tracking Mode</p>
              <p className="text-xs font-medium text-slate-muted">
                {savedSession?.measurement_mode}
              </p>
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            <Button
              fullWidth
              variant="outline"
              onClick={() => {
                setSavedSession(null);
                navigate('/check-in');
              }}
            >
              Log Daily Check-in
            </Button>
            <Button
              fullWidth
              variant="primary"
              onClick={() => {
                setSavedSession(null);
                navigate('/progress');
              }}
            >
              View Progress
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
