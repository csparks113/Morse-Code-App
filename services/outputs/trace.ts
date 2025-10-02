import { isOutputsTracingEnabled, useDeveloperStore } from '@/store/useDeveloperStore';
import { nowMs } from '@/utils/time';

type TracePayload = Record<string, unknown>;

export function traceOutputs(event: string, payload?: TracePayload): void {
  if (!isOutputsTracingEnabled()) {
    return;
  }

  const timestamp = nowMs();
  const wallClock = Date.now();
  const details = payload ? { ...payload } : undefined;

  useDeveloperStore.getState().appendTrace({
    event,
    timestamp,
    wallClock,
    payload: details,
  });

  // eslint-disable-next-line no-console
  console.log(`[outputs] ${event}`, {
    timestamp,
    wallClock,
    ...(details ?? {}),
  });
}