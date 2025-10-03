import { toMonotonicTime } from '@/utils/time';

const SOURCE_SANITIZE = /[^a-zA-Z0-9]/g;

function generateRandomId(): string {
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${time}${random}`;
}

function normalizeSource(source: string): string {
  const stripped = source.replace(SOURCE_SANITIZE, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return stripped || 'press';
}

export type PressCorrelation = {
  id: string;
  source: string;
  startedAtMs: number;
};

export type CompletedPress = PressCorrelation & {
  endedAtMs: number;
  holdDurationMs: number;
};

export interface PressTracker {
  begin(rawTimestamp?: number | null): PressCorrelation;
  end(rawTimestamp?: number | null): CompletedPress | null;
  peek(): PressCorrelation | null;
  reset(): void;
}

export function normalizePressTimestamp(rawTimestamp?: number | null): number {
  return toMonotonicTime(typeof rawTimestamp === 'number' ? rawTimestamp : undefined);
}

export function createPressCorrelation(source: string, rawTimestamp?: number | null): PressCorrelation {
  const normalizedSource = normalizeSource(source);
  return {
    id: `${normalizedSource}:${generateRandomId()}`,
    source,
    startedAtMs: normalizePressTimestamp(rawTimestamp),
  };
}

export function createPressTracker(source: string): PressTracker {
  let active: PressCorrelation | null = null;

  return {
    begin(rawTimestamp) {
      const correlation = createPressCorrelation(source, rawTimestamp);
      active = correlation;
      return correlation;
    },
    end(rawTimestamp) {
      if (!active) {
        return null;
      }
      const endedAtMs = normalizePressTimestamp(rawTimestamp);
      const holdDurationMs = Math.max(0, endedAtMs - active.startedAtMs);
      const completed: CompletedPress = {
        ...active,
        endedAtMs,
        holdDurationMs,
      };
      active = null;
      return completed;
    },
    peek() {
      return active;
    },
    reset() {
      active = null;
    },
  };
}
