// ReKnee AI - Biomechanical Angle Calculation
// Computes joint angles from 2D/3D normalized pose landmarks

import { Landmark2D, LegLandmarks, TrackingSide } from './types';

// MediaPipe Pose Landmark standard indices
export const POSE_LANDMARKS = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

/**
 * Calculates the interior angle at joint B given three landmarks A, B, and C.
 * For knee angle: A = Hip, B = Knee (vertex), C = Ankle.
 * Returns angle in degrees between 0° and 180°.
 */
export function calculateJointAngle(
  pointA: Landmark2D,
  pointB: Landmark2D,
  pointC: Landmark2D
): number {
  if (!pointA || !pointB || !pointC) return 180;

  // Vector BA: from B to A (Knee to Hip)
  const vBAx = pointA.x - pointB.x;
  const vBAy = pointA.y - pointB.y;

  // Vector BC: from B to C (Knee to Ankle)
  const vBCx = pointC.x - pointB.x;
  const vBCy = pointC.y - pointB.y;

  const magBA = Math.sqrt(vBAx * vBAx + vBAy * vBAy);
  const magBC = Math.sqrt(vBCx * vBCx + vBCy * vBCy);

  if (magBA < 0.0001 || magBC < 0.0001) {
    return 180;
  }

  // Dot product
  const dot = vBAx * vBCx + vBAy * vBCy;

  // Cosine of angle
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));

  // Convert radians to degrees
  const angleRad = Math.acos(cosAngle);
  const angleDeg = (angleRad * 180) / Math.PI;

  return Math.round(angleDeg * 10) / 10;
}

/**
 * Extracts leg landmarks and selects the best tracking side based on landmark visibility and preference.
 */
export function extractLegLandmarks(
  landmarks: Landmark2D[],
  preference: TrackingSide = 'auto'
): LegLandmarks | null {
  if (!landmarks || landmarks.length < 29) return null;

  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
  const leftKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
  const leftAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];

  const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
  const rightKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
  const rightAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];

  // Helper to calculate average visibility confidence
  const getConf = (h: Landmark2D, k: Landmark2D, a: Landmark2D) => {
    const vH = h.visibility ?? 0.8;
    const vK = k.visibility ?? 0.8;
    const vA = a.visibility ?? 0.8;
    return (vH + vK + vA) / 3;
  };

  const leftConf = getConf(leftHip, leftKnee, leftAnkle);
  const rightConf = getConf(rightHip, rightKnee, rightAnkle);

  // Confidence cutoff for reliable tracking
  const MIN_CONFIDENCE = 0.35;

  let chosenSide: 'left' | 'right';

  if (preference === 'left') {
    chosenSide = 'left';
  } else if (preference === 'right') {
    chosenSide = 'right';
  } else {
    // Auto: pick the side with higher visibility confidence
    chosenSide = rightConf > leftConf ? 'right' : 'left';
  }

  const chosenConf = chosenSide === 'left' ? leftConf : rightConf;
  if (chosenConf < MIN_CONFIDENCE) {
    return null;
  }

  return {
    hip: chosenSide === 'left' ? leftHip : rightHip,
    knee: chosenSide === 'left' ? leftKnee : rightKnee,
    ankle: chosenSide === 'left' ? leftAnkle : rightAnkle,
    side: chosenSide,
    confidence: chosenConf,
  };
}
