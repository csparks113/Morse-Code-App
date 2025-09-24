// utils/morseUtils.ts
// Timing + render-friendly elements. Reuses your utils/morse lookups elsewhere.

import { toMorse } from "@/utils/morse";

export type MorseElement =
  | { kind: "dot"; units: number; groupId?: string }
  | { kind: "dash"; units: number; groupId?: string }
  | { kind: "gap"; units: number; groupId?: string };

export type PressWindow = { startMs: number; endMs: number };

// ITU "PARIS": 1 unit = dot length (ms = 1200 / WPM)
export const unitMsFromWpm = (wpm: number) => 1200 / Math.max(1, wpm);

// Canonical unit lengths
export const DOT_UNITS = 1;
export const DEFAULT_DASH_UNITS = 3;   // ITU
export const INTRA_CHAR_GAP_UNITS = 1;
export const INTER_CHAR_GAP_UNITS = 3;
export const WORD_GAP_UNITS = 7;

// Quantize units to a grid (e.g., 4 => 1/4 units)
export const quantizeUnits = (units: number, granularity: number) =>
  Math.max(0, Math.round(units * granularity)) / granularity;

/** Build canonical timed sequence (with gaps) from a text/char. */
export function textToMorseElements(
  text: string,
  dashUnits: number = DEFAULT_DASH_UNITS
): MorseElement[] {
  const out: MorseElement[] = [];
  const words = text.split(/\s+/);
  let charSeq = 0;

  words.forEach((word, wIdx) => {
    const chars = [...word];
    chars.forEach((ch, cIdx) => {
      const pattern = toMorse(ch) ?? "";
      if (!pattern) return;

      const groupId = `w${wIdx}-c${charSeq++}`;
      const tokens = [...pattern];

      tokens.forEach((tok, tIdx) => {
        out.push(tok === "."
          ? { kind: "dot",  units: DOT_UNITS,   groupId }
          : { kind: "dash", units: dashUnits,   groupId }
        );
        if (tIdx < tokens.length - 1) {
          out.push({ kind: "gap", units: INTRA_CHAR_GAP_UNITS, groupId });
        }
      });

      if (cIdx < chars.length - 1) {
        out.push({ kind: "gap", units: INTER_CHAR_GAP_UNITS, groupId });
      }
    });

    if (wIdx < words.length - 1) {
      out.push({ kind: "gap", units: WORD_GAP_UNITS });
    }
  });

  return out;
}

/**
 * Convert presses to elements **with gaps** between presses:
 * - Adds a gap before each press (except the first) equal to (start_i - end_{i-1})
 * - Each press becomes a "dash" bar whose width = duration / unitMs
 * - Gaps are represented as {kind: "gap"} with units, to consume width (render them transparent)
 * - Quantized to `granularity` (default 4 => 1/4 units)
 */
export function pressesToElementsWithGaps(
  presses: PressWindow[],
  unitMs: number,
  granularity: number = 4
): MorseElement[] {
  const el: MorseElement[] = [];
  if (!presses || presses.length === 0 || unitMs <= 0) return el;

  const sorted = [...presses].sort((a, b) => a.startMs - b.startMs);

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const durMs = Math.max(0, p.endMs - p.startMs);
    const durUnits = quantizeUnits(durMs / unitMs, granularity);

    if (i > 0) {
      const prev = sorted[i - 1];
      const gapMs = Math.max(0, p.startMs - prev.endMs);
      const gapUnits = quantizeUnits(gapMs / unitMs, granularity);
      if (gapUnits > 0) {
        el.push({ kind: "gap", units: gapUnits });
      }
    }

    if (durUnits > 0) {
      // render presses as bars (use timeline color), not dots
      el.push({ kind: "dash", units: durUnits });
    }
  }

  return el;
}

/** Legacy: bars-only, no gaps (kept for compatibility) */
export function pressesToElements(
  presses: PressWindow[],
  unitMs: number
): MorseElement[] {
  return pressesToElementsWithGaps(presses, unitMs, 1); // effectively 1-unit granularity, with gaps
}
