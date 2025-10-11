import { isOutputsTracingEnabled, useDeveloperStore } from '@/store/useDeveloperStore';
import { nowMs } from '@/utils/time';

type TracePayload = Record<string, unknown>;

export function traceOutputs(event: string, payload?: TracePayload): void {
  const timestamp = nowMs();

  if (event === 'session.send.ignorePress.set') {
    const valueRaw = (payload as { value?: unknown } | undefined)?.value;
    const reasonRaw = (payload as { reason?: unknown } | undefined)?.reason;
    const activePressIdRaw = (payload as { activePressId?: unknown } | undefined)?.activePressId;
    useDeveloperStore.getState().setIgnorePressState({
      value: Boolean(valueRaw),
      reason: typeof reasonRaw === 'string' ? reasonRaw : null,
      activePressId:
        typeof activePressIdRaw === 'string'
          ? activePressIdRaw
          : activePressIdRaw != null
            ? String(activePressIdRaw)
            : null,
      changedAtMs: timestamp,
    });
  }

  if (!isOutputsTracingEnabled()) {
    return;
  }

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
