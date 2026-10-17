// ReKnee AI - Canvas Pose Overlay Rendering
// Clean, medical-appropriate visualization of anatomical landmarks and angle arcs

import { LegLandmarks } from './types';

export interface DrawOptions {
  kneeAngle: number;
  phase: string;
  holdProgressPercent: number;
}

/**
 * Renders anatomical skeleton lines and joint indicators for the tracked leg.
 */
export function drawPoseOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  legLandmarks: LegLandmarks | null,
  options: DrawOptions
): void {
  ctx.clearRect(0, 0, width, height);

  if (!legLandmarks) return;

  const { hip, knee, ankle, side } = legLandmarks;

  // Transform normalized 0..1 coordinates to canvas pixel space
  const hX = hip.x * width;
  const hY = hip.y * height;
  const kX = knee.x * width;
  const kY = knee.y * height;
  const aX = ankle.x * width;
  const aY = ankle.y * height;

  // Draw bone connecting lines (Thigh and Shin)
  ctx.save();
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Highlight thigh
  ctx.strokeStyle = '#0D9488'; // Calm teal
  ctx.beginPath();
  ctx.moveTo(hX, hY);
  ctx.lineTo(kX, kY);
  ctx.stroke();

  // Highlight shin
  ctx.strokeStyle = options.phase === 'flexed_hold' ? '#10B981' : '#0D9488';
  ctx.beginPath();
  ctx.moveTo(kX, kY);
  ctx.lineTo(aX, aY);
  ctx.stroke();

  // Draw angle arc at Knee vertex
  if (options.kneeAngle > 0) {
    ctx.beginPath();
    ctx.strokeStyle = options.phase === 'flexed_hold' ? '#10B981' : '#38BDF8';
    ctx.lineWidth = 3;
    const arcRadius = 32;
    const angleStart = Math.atan2(hY - kY, hX - kX);
    const angleEnd = Math.atan2(aY - kY, aX - kX);
    ctx.arc(kX, kY, arcRadius, angleStart, angleEnd, false);
    ctx.stroke();
  }

  // Draw joint circular nodes
  const drawJointNode = (
    x: number,
    y: number,
    label: string,
    isTargetJoint: boolean = false
  ) => {
    // Outer glow / border
    ctx.beginPath();
    ctx.arc(x, y, isTargetJoint ? 10 : 8, 0, 2 * Math.PI);
    ctx.fillStyle = isTargetJoint ? '#0D9488' : '#0F1D38';
    ctx.fill();

    // Inner circle
    ctx.beginPath();
    ctx.arc(x, y, isTargetJoint ? 6 : 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // Text Label badge
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#0F1D38';
    ctx.fillText(label, x + 14, y + 4);
  };

  drawJointNode(hX, hY, `Hip (${side})`);
  drawJointNode(kX, kY, `Knee (${options.kneeAngle}°)`, true);
  drawJointNode(aX, aY, 'Ankle');

  // If in hold phase, draw hold progress ring around knee
  if (options.phase === 'flexed_hold' && options.holdProgressPercent > 0) {
    const ringRadius = 24;
    const endAngle = (options.holdProgressPercent / 100) * 2 * Math.PI - Math.PI / 2;

    ctx.beginPath();
    ctx.arc(kX, kY, ringRadius, -Math.PI / 2, endAngle, false);
    ctx.strokeStyle = '#10B981'; // Green
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws a clean simulated anatomical skeleton for demonstration mode.
 */
export function drawSimulatedOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  simulatedAngle: number,
  options: DrawOptions
): void {
  ctx.clearRect(0, 0, width, height);

  const centerX = width * 0.52;
  const hipY = height * 0.38;
  const kneeY = height * 0.65;

  const rad = ((180 - simulatedAngle) * Math.PI) / 180;
  const shinLength = height * 0.25;
  const ankleX = centerX - Math.sin(rad) * shinLength;
  const ankleY = kneeY + Math.cos(rad) * shinLength;

  const simulatedLandmarks: LegLandmarks = {
    hip: { x: centerX / width, y: hipY / height, visibility: 0.95 },
    knee: { x: centerX / width, y: kneeY / height, visibility: 0.95 },
    ankle: { x: ankleX / width, y: ankleY / height, visibility: 0.95 },
    side: 'right',
    confidence: 0.95,
  };

  drawPoseOverlay(ctx, width, height, simulatedLandmarks, options);
}
