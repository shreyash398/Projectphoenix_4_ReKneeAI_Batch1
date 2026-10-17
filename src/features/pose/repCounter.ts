// ReKnee AI - Transparent Repetition Counter State Machine
// Simple, deterministic, configurable state engine for seated knee flexion & extension

import { RepCounterConfig, RepCounterState } from './types';

export const DEFAULT_REP_CONFIG: RepCounterConfig = {
  extensionThreshold: 145, // Straight/extended knee (degrees)
  flexionThreshold: 105,   // Target bent knee under chair (degrees)
  minHoldMs: 1200,         // Hold time at maximum bend (1.2 seconds)
  targetReps: 10,
  sidePreference: 'auto',
};

export function createInitialRepCounterState(): RepCounterState {
  return {
    repetitions: 0,
    currentAngle: 160,
    phase: 'ready_start',
    holdStartTime: null,
    holdProgressPercent: 0,
    feedbackMessage: 'Position your chair and slide your heel back to begin',
    lastRepTimestamp: null,
  };
}

/**
 * Pure state machine transition for seated knee flexion/extension.
 * Transparent and predictable:
 * ready_start -> flexing -> flexed_hold (holds for minHoldMs) -> extending -> rep_completed -> ready_start
 */
export function updateRepCounter(
  prevState: RepCounterState,
  currentAngle: number,
  config: RepCounterConfig = DEFAULT_REP_CONFIG,
  nowMs: number = Date.now()
): RepCounterState {
  const roundedAngle = Math.round(currentAngle);
  const next: RepCounterState = {
    ...prevState,
    currentAngle: roundedAngle,
  };

  switch (prevState.phase) {
    case 'ready_start': {
      next.holdStartTime = null;
      next.holdProgressPercent = 0;

      if (roundedAngle <= config.flexionThreshold) {
        next.phase = 'flexed_hold';
        next.holdStartTime = nowMs;
        next.feedbackMessage = 'Target bend reached! Hold steady...';
      } else if (roundedAngle <= config.extensionThreshold - 10) {
        next.phase = 'flexing';
        next.feedbackMessage = 'Sliding foot back... bend slowly and smoothly.';
      } else {
        next.feedbackMessage = 'Ready: Slowly slide your operative heel backwards under the chair.';
      }
      break;
    }

    case 'flexing': {
      if (roundedAngle <= config.flexionThreshold) {
        // Target flexion reached, enter hold phase
        next.phase = 'flexed_hold';
        next.holdStartTime = nowMs;
        next.holdProgressPercent = 0;
        next.feedbackMessage = 'Target bend reached! Hold steady...';
      } else if (roundedAngle >= config.extensionThreshold) {
        // Returned to extension without achieving target flexion
        next.phase = 'ready_start';
        next.feedbackMessage = 'Foot returned to start. Slide back gently to target bend.';
      } else {
        next.feedbackMessage = `Bending knee (${roundedAngle}°)... aim for ${config.flexionThreshold}° or comfortable depth.`;
      }
      break;
    }

    case 'flexed_hold': {
      const startTime = prevState.holdStartTime ?? nowMs;
      const elapsed = nowMs - startTime;
      const holdRatio = Math.min(1, elapsed / config.minHoldMs);
      next.holdProgressPercent = Math.round(holdRatio * 100);

      // If patient loses bend significantly before hold completes
      if (roundedAngle > config.flexionThreshold + 20) {
        next.phase = 'extending';
        next.holdStartTime = null;
        next.holdProgressPercent = 0;
        next.feedbackMessage = 'Released early. Returning to extension...';
      } else if (elapsed >= config.minHoldMs) {
        // Hold satisfied! Transition to extension phase
        next.phase = 'extending';
        next.feedbackMessage = 'Hold complete! Now gently straighten your leg forward.';
      } else {
        const remainingSec = Math.max(0.1, (config.minHoldMs - elapsed) / 1000).toFixed(1);
        next.feedbackMessage = `Holding bend (${roundedAngle}°)... hold for ${remainingSec}s`;
      }
      break;
    }

    case 'extending': {
      next.holdStartTime = null;
      next.holdProgressPercent = 0;

      if (roundedAngle >= config.extensionThreshold) {
        // Full repetition completed
        const updatedReps = prevState.repetitions + 1;
        next.repetitions = updatedReps;
        next.phase = 'rep_completed';
        next.lastRepTimestamp = nowMs;
        next.feedbackMessage = `Repetition ${updatedReps} complete! Controlled form.`;
      } else {
        next.feedbackMessage = `Straightening leg (${roundedAngle}°)... return to ${config.extensionThreshold}°`;
      }
      break;
    }

    case 'rep_completed': {
      // Automatic transition back to ready state
      next.phase = 'ready_start';
      next.feedbackMessage = 'Ready for your next repetition. Slide foot back smoothly.';
      break;
    }
  }

  return next;
}
