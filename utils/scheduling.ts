import { nowMs } from '@/utils/time';

type TimeoutHandle = ReturnType<typeof setTimeout>;

type ScheduleOptions = {
  startMs?: number | null;
  offsetMs?: number;
};

/**
 * Schedules `action` relative to a monotonic timestamp when available.
 * Falls back to plain setTimeout (or immediate invocation) when we do not
 * receive a monotonic baseline.
 */
export function scheduleMonotonic(
  action: () => void,
  options?: ScheduleOptions,
): TimeoutHandle | null {
  const startMs = options?.startMs;
  const offsetMsRaw = options?.offsetMs ?? 0;
  const offsetMs = Number.isFinite(offsetMsRaw) ? Number(offsetMsRaw) : 0;

  if (typeof startMs === 'number' && Number.isFinite(startMs)) {
    const target = startMs + offsetMs;
    const delay = Math.max(0, target - nowMs());
    if (delay <= 1) {
      action();
      return null;
    }
    return setTimeout(action, delay);
  }

  if (offsetMs > 0) {
    return setTimeout(action, offsetMs);
  }

  action();
  return null;
}

