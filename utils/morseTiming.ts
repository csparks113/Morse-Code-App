// Timing helpers for classifying *measured* keyer press durations and gaps
// into canonical Morse categories. Keep this file pure/logic-only so it can
// be reused by Send, Receive (validation), and Practice modules.

export type MorseSignal = '.' | '-';
export type MorseGap = 'intra' | 'inter' | 'word';

/**
 * MORSE_UNITS
 * -----------
 * Durations expressed in "dot units" (relative time):
 * - dot         = 1 unit
 * - dash        = 3 units
 * - interChar   = 3 units (gap between letters)
 * - word        = 7 units (gap between words)
 *
 * NOTE: A real-world duration in milliseconds is units * unitMs,
 * where unitMs depends on WPM (e.g., at 12 WPM, unitMs â‰ˆ 100 ms).
 */
export const MORSE_UNITS = {
  dot: 1,
  dash: 3,
  interChar: 3,
  word: 7,
} as const;

// Tolerance clamps: prevent nonsensical values (too strict or too lenient).
const MIN_TOLERANCE = 0.05; // 5% minimal slack
const MAX_TOLERANCE = 0.9;  // 90% maximal slack (effectively "anything goes")

/**
 * classifySignalDuration
 * ----------------------
 * Map a measured press duration (ms) into a dot '.' or dash '-' using:
 *  - unitMs: length of one dot in milliseconds (derived from WPM)
 *  - tolerance: allowed proportional error (0..1) around target values
 *
 * Rules:
 * - If duration <= dotUpper (1 unit + tol), it's a dot.
 * - Else if within [dashLower, dashUpper] around 3 units, it's a dash.
 * - Otherwise, return null (unclassifiable).
 *
 * Examples (unitMs = 100ms, tolerance = 0.3):
 * - dotUpper   = 100 * 1.3 = 130ms  -> <= 130ms is a dot
 * - dashTarget = 300ms
 *   [dashLower, dashUpper] = [210ms, 390ms] -> in range is a dash
 */
export function classifySignalDuration(
  durationMs: number,
  unitMs: number,
  tolerance: number,
): MorseSignal | null {
  if (durationMs <= 0) return null;

  // Clamp caller-provided tolerance to a sane range
  const clampedTol = Math.max(MIN_TOLERANCE, Math.min(tolerance, MAX_TOLERANCE));

  // Dot: anything up to 1 unit with tolerance
  const dotUpper = unitMs * (1 + clampedTol);
  if (durationMs <= dotUpper) return '.';

  // Dash: within tolerance window around 3 units
  const dashTarget = unitMs * MORSE_UNITS.dash;
  const dashLower = dashTarget * (1 - clampedTol);
  const dashUpper = dashTarget * (1 + clampedTol);
  if (durationMs >= dashLower && durationMs <= dashUpper) return '-';

  // Neither dot nor dash within the allowed error
  return null;
}

/**
 * classifyGapDuration
 * -------------------
 * Map a measured "silent" duration (ms) between presses into one of:
 *  - 'intra' (gap between elements in a character)   -> 1 unit
 *  - 'inter' (gap between characters)                -> 3 units
 *  - 'word'  (gap between words)                     -> 7 units
 *
 * Method:
 * - Compute the relative error to each canonical target and pick the
 *   best match (smallest ratio). If the best ratio <= tolerance, return
 *   that gap type; otherwise return null.
 *
 * This "nearest target" approach is more robust than hard thresholds
 * when users vary around boundaries.
 */
export function classifyGapDuration(
  durationMs: number,
  unitMs: number,
  tolerance: number,
): MorseGap | null {
  const targets: { type: MorseGap; duration: number }[] = [
    { type: 'intra', duration: unitMs * MORSE_UNITS.dot },
    { type: 'inter', duration: unitMs * MORSE_UNITS.interChar },
    { type: 'word',  duration: unitMs * MORSE_UNITS.word },
  ];

  // Find the canonical duration with the smallest relative error
  let best: { type: MorseGap; ratio: number } | undefined;
  for (const target of targets) {
    const ratio = Math.abs(durationMs - target.duration) / target.duration;
    if (!best || ratio < best.ratio) {
      best = { type: target.type, ratio };
    }
  }

  // Accept only if the smallest relative error is within caller tolerance
  return best && best.ratio <= tolerance ? best.type : null;
}

/**
 * getMorseUnitMs
 * --------------
 * Re-exported helper that returns the current "dot" length in milliseconds,
 * typically computed from the user's WPM setting (e.g., unitMs = 1200 / WPM).
 * Keep timing logic centralized so every screen stays in sync.
 */
export { getMorseUnitMs } from './audio';
