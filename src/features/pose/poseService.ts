// ReKnee AI - MediaPipe Pose Service
// Initializes and manages the MediaPipe PoseLandmarker for on-device tracking

import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

let landmarkerInstance: PoseLandmarker | null = null;
let isInitializing = false;

// MediaPipe official CDN WASM assets
const VISION_WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
// MediaPipe lightweight pose model (float16) for responsive mobile/browser execution
const POSE_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

/**
 * Initializes the PoseLandmarker instance with GPU acceleration, falling back to CPU.
 * Reuses existing instance if already initialized.
 */
export async function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (landmarkerInstance) {
    return landmarkerInstance;
  }

  if (isInitializing) {
    // Wait briefly if initialization is already underway
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (landmarkerInstance) return landmarkerInstance;
  }

  isInitializing = true;

  try {
    const vision = await FilesetResolver.forVisionTasks(VISION_WASM_PATH);

    try {
      // Primary: GPU delegate
      landmarkerInstance = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: POSE_MODEL_PATH,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.4,
        minPosePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
    } catch (gpuError) {
      console.warn('MediaPipe GPU initialization failed, falling back to CPU delegate:', gpuError);
      // Fallback: CPU delegate
      landmarkerInstance = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: POSE_MODEL_PATH,
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.4,
        minPosePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
      });
    }

    return landmarkerInstance;
  } catch (err) {
    console.error('Failed to load MediaPipe PoseLandmarker:', err);
    throw new Error(
      'Could not initialize MediaPipe Pose model. Check network connectivity or use guided exercise mode.',
      { cause: err }
    );
  } finally {
    isInitializing = false;
  }
}

/**
 * Closes and resets the PoseLandmarker instance if needed.
 */
export function resetPoseLandmarker(): void {
  if (landmarkerInstance) {
    try {
      landmarkerInstance.close();
    } catch (e) {
      console.warn('Error closing PoseLandmarker:', e);
    }
    landmarkerInstance = null;
  }
  isInitializing = false;
}
