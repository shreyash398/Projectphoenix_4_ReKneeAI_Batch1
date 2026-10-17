// ReKnee AI - Pose Detection & Rep Counting Types
// Strictly adhering to 03_ARCHITECTURE.md, 04_DATABASE.md, and 13_EXTERNAL_INTEGRATION.md

export type CameraStatus =
  | 'idle'
  | 'requesting_permission'
  | 'permission_denied'
  | 'camera_unavailable'
  | 'active'
  | 'paused'
  | 'stopped';

export type ModelStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'failed'
  | 'fallback_demo';

export type DetectionQuality = 'good' | 'low_confidence' | 'no_pose';

export type MovementPhase =
  | 'ready_start'
  | 'flexing'
  | 'flexed_hold'
  | 'extending'
  | 'rep_completed';

export type TrackingSide = 'left' | 'right' | 'auto';

export interface Landmark2D {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface LegLandmarks {
  hip: Landmark2D;
  knee: Landmark2D;
  ankle: Landmark2D;
  side: 'left' | 'right';
  confidence: number;
}

export interface RepCounterConfig {
  /** Angle in degrees representing the extended or resting knee position (e.g., 145-160°) */
  extensionThreshold: number;
  /** Angle in degrees representing target knee flexion (e.g., 95-105°) */
  flexionThreshold: number;
  /** Minimum hold time in milliseconds at peak flexion before return (default 1000ms) */
  minHoldMs: number;
  /** Target repetitions for the session */
  targetReps: number;
  /** Tracked side preference */
  sidePreference: TrackingSide;
}

export interface RepCounterState {
  repetitions: number;
  currentAngle: number;
  phase: MovementPhase;
  holdStartTime: number | null;
  holdProgressPercent: number; // 0 to 100
  feedbackMessage: string;
  lastRepTimestamp: number | null;
}

export interface PoseFrameResult {
  landmarksDetected: boolean;
  quality: DetectionQuality;
  legLandmarks: LegLandmarks | null;
  kneeAngle: number | null;
  timestampMs: number;
}
