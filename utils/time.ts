const fallbackPerformance = typeof performance !== 'undefined' && typeof performance.now === 'function';
let epochOffset: number | null = null;

export function nowMs(): number {
  if (fallbackPerformance) {
    return performance.now();
  }
  return Date.now();
}

function ensureEpochOffset(): number {
  if (epochOffset == null) {
    epochOffset = nowMs() - Date.now();
  }
  return epochOffset;
}

export function toMonotonicTime(value?: number | null): number {
  const fallback = nowMs();
  if (value == null) {
    return fallback;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  if (numeric > 1e12) {
    const offset = ensureEpochOffset();
    return numeric + offset;
  }

  if (Math.abs(numeric - fallback) <= 2000) {
    return numeric;
  }

  const scaled = numeric * 1000;
  if (Math.abs(scaled - fallback) <= 2000) {
    return scaled;
  }

  return fallback;
}