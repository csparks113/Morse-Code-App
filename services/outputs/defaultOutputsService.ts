import { Animated, Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

import { playMorseCode, stopPlayback, createToneController } from '@/utils/audio';
import type { NativeSymbolTimingContext } from '@/utils/audio';
import { acquireTorch, releaseTorch, resetTorch, isTorchAvailable, forceTorchOff } from '@/utils/torch';
import { nowMs, toMonotonicTime } from '@/utils/time';
import { scheduleMonotonic } from '@/utils/scheduling';
import { traceOutputs } from './trace';
import { updateTorchSupport, recordTorchPulse, recordTorchFailure } from '@/store/useOutputsDiagnosticsStore';
import { recordLatencySample } from '@/store/useOutputsLatencyStore';
import { createPressCorrelation, createPressTracker, normalizePressTimestamp, type PressCorrelation } from '@/services/latency/pressTracker';
import { setNativeFlashOverlayState, setNativeScreenBrightnessBoost } from './nativeFlashOverlay';
import type {
  OutputsService,
  FlashPulseOptions,
  HapticSymbolOptions,
  PlayMorseOptions,
  KeyerOutputsOptions,
  KeyerOutputsHandle,
  KeyerOutputsContext,
} from './OutputsService';

const DEFAULT_TONE_HZ = 600;

const computeFlashTimings = (durationMs: number) => {
  const fadeMs = Math.min(240, Math.max(120, Math.floor(durationMs * 0.35)));
  const holdMs = Math.max(0, Math.floor(durationMs - fadeMs));
  return { fadeMs, holdMs };
};

const clampToneHz = (value: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return DEFAULT_TONE_HZ;
  }
  return Math.max(80, Math.min(2000, Math.round(numeric)));
};

const clampPercentToScalar = (percent?: number) => {
  const numeric = Number(percent);
  if (!Number.isFinite(numeric)) {
    return 1;
  }
  return Math.max(0, Math.min(1, numeric / 100));
};

const clampVolumePercent = (percent?: number) => {
  const numeric = Number(percent);
  if (!Number.isFinite(numeric)) {
    return 100;
  }
  return Math.max(0, Math.min(100, Math.round(numeric)));
};

const playbackVibrationState: {
  timeout: ReturnType<typeof setTimeout> | null;
} = {
  timeout: null,
};

const WATCHDOG_PRESS_TIMEOUT_MS = 4000;

const NATIVE_OFFSET_SPIKE_THRESHOLD_MS = 80;
const FLASH_TIMELINE_LEAD_MS = 8;
const AUDIO_START_MIN_HEADROOM_MS = 6;
const AUDIO_START_MAX_NATIVE_SKEW_MS = 25;
const AUDIO_START_MAX_NATIVE_AGE_MS = 90;
const AUDIO_START_FALLBACK_TIMELINE_MS = 12;
const AUDIO_START_MAX_COMPENSATION_MS = 160;
const FLASH_PRESCHEDULE_BASELINE_MS = 32;
const FLASH_PRESCHEDULE_MIN_MS = 6;
const FLASH_PRESCHEDULE_MAX_MS = 192;
const FLASH_PRESCHEDULE_BUFFER_MS = 6;
const FLASH_PRESCHEDULE_SMOOTHING_ALPHA = 0.25;
const FLASH_PRESCHEDULE_DECAY_DELAY_MS = 1500;
const FLASH_PRESCHEDULE_DECAY_WINDOW_MS = 4000;
const FLASH_PRESCHEDULE_MAX_SAMPLE_MS = 400;
const FLASH_AUDIO_START_LEAD_RATIO = 0.98;
const FLASH_AUDIO_START_LEAD_OFFSET_MS = 24;
const FLASH_AUDIO_START_LEAD_MIN_MS = 10;
const FLASH_AUDIO_START_LEAD_MAX_MS = 96;
const FLASH_AUDIO_START_TARGET_MARGIN_MS = 2;
const CONSOLE_REPLAY_AUDIO_START_TARGET_MARGIN_MS = 24;
const CONSOLE_REPLAY_MIN_AUDIO_START_LEAD_MS = 8;
const FLASH_HEADROOM_SMOOTHING_ALPHA = 0.35;
const FLASH_HEADROOM_SMOOTHING_WINDOW_MS = 400;
const FLASH_HEADROOM_SMOOTHING_DECAY_MS = 1200;
const HEADROOM_SMOOTHING_DEFAULT_KEY = -1;

let pendingFlashPulseTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingFlashPulseFrame: number | null = null;
let pendingTimelineFallback: ReturnType<typeof setTimeout> | null = null;
const raf =
  typeof globalThis.requestAnimationFrame === 'function'
    ? globalThis.requestAnimationFrame.bind(globalThis)
    : null;
const caf =
  typeof globalThis.cancelAnimationFrame === 'function'
    ? globalThis.cancelAnimationFrame.bind(globalThis)
    : null;

type FlashSchedulerState = {
  smoothedSkewMs: number;
  lastSampleAtMs: number;
};

let flashSchedulerState: FlashSchedulerState = {
  smoothedSkewMs: FLASH_PRESCHEDULE_BASELINE_MS,
  lastSampleAtMs: 0,
};

type HeadroomSmoothingEntry = {
  value: number;
  updatedAt: number;
};

const headroomSmoothingState = new Map<number, HeadroomSmoothingEntry>();

const updateHeadroomEstimate = (
  rawDuration: number | undefined,
  sampleMs: number,
  timestampMs: number,
): number => {
  if (!Number.isFinite(sampleMs)) {
    return sampleMs;
  }
  const key =
    typeof rawDuration === 'number' && Number.isFinite(rawDuration) && rawDuration > 0
      ? Math.round(rawDuration)
      : HEADROOM_SMOOTHING_DEFAULT_KEY;
  const previous = headroomSmoothingState.get(key);
  let nextValue = sampleMs;
  if (previous) {
    const elapsed = Math.max(0, timestampMs - previous.updatedAt);
    const normalizedWindow = Math.max(1, FLASH_HEADROOM_SMOOTHING_WINDOW_MS);
    const normalizedDecay = Math.max(1, FLASH_HEADROOM_SMOOTHING_DECAY_MS);
    const windowSteps =
      elapsed <= 0 ? 0 : Math.min(elapsed / normalizedWindow, elapsed / normalizedWindow);
    const alpha = 1 - Math.pow(1 - FLASH_HEADROOM_SMOOTHING_ALPHA, windowSteps);
    nextValue = previous.value + (sampleMs - previous.value) * alpha;
  }
  headroomSmoothingState.set(key, {
    value: nextValue,
    updatedAt: timestampMs,
  });
  return nextValue;
};

const recordFlashPreScheduleSkew = (sampleMs: number) => {
  if (!Number.isFinite(sampleMs) || sampleMs <= 0) {
    return;
  }
  const clamped = Math.min(
    FLASH_PRESCHEDULE_MAX_SAMPLE_MS,
    Math.max(0, sampleMs),
  );
  const now = nowMs();
  const alpha =
    flashSchedulerState.lastSampleAtMs === 0
      ? 1
      : FLASH_PRESCHEDULE_SMOOTHING_ALPHA;
  const next =
    flashSchedulerState.smoothedSkewMs +
    (clamped - flashSchedulerState.smoothedSkewMs) * alpha;
  flashSchedulerState = {
    smoothedSkewMs: next,
    lastSampleAtMs: now,
  };
};

type FlashAdaptiveLead = {
  preScheduleLeadMs: number;
  displayLeadMs: number;
};

const getFlashAdaptiveLeads = (
  referenceNow: number,
  mode: 'timeline' | 'audio-start',
  isConsoleReplay: boolean = false,
): FlashAdaptiveLead => {
  if (mode !== 'audio-start') {
    return { preScheduleLeadMs: 0, displayLeadMs: 0 };
  }

  let effective = flashSchedulerState.smoothedSkewMs;
  if (!Number.isFinite(effective) || effective <= 0) {
    effective = FLASH_PRESCHEDULE_BASELINE_MS;
  }

  if (flashSchedulerState.lastSampleAtMs > 0) {
    const elapsed = referenceNow - flashSchedulerState.lastSampleAtMs;
    if (elapsed > FLASH_PRESCHEDULE_DECAY_DELAY_MS) {
      const decayWindow = Math.max(1, FLASH_PRESCHEDULE_DECAY_WINDOW_MS);
      const decayProgress = Math.min(
        1,
            (elapsed - FLASH_PRESCHEDULE_DECAY_DELAY_MS) / decayWindow,
      );
      effective =
        effective * (1 - decayProgress) +
        FLASH_PRESCHEDULE_BASELINE_MS * decayProgress;
    }
  }

  let preScheduleLeadMs = Math.max(
    FLASH_PRESCHEDULE_MIN_MS,
    Math.min(FLASH_PRESCHEDULE_MAX_MS, effective - FLASH_PRESCHEDULE_BUFFER_MS),
  );

  let displayLeadMs = Math.max(
    0,
    effective * FLASH_AUDIO_START_LEAD_RATIO - FLASH_AUDIO_START_LEAD_OFFSET_MS,
  );
  if (displayLeadMs > 0 && displayLeadMs < FLASH_AUDIO_START_LEAD_MIN_MS) {
    displayLeadMs = FLASH_AUDIO_START_LEAD_MIN_MS;
  }
  displayLeadMs = Math.min(FLASH_AUDIO_START_LEAD_MAX_MS, displayLeadMs);
  if (displayLeadMs > preScheduleLeadMs) {
    displayLeadMs = preScheduleLeadMs;
  }

  if (!Number.isFinite(displayLeadMs) || displayLeadMs < 0) {
    displayLeadMs = 0;
  }
  if (!Number.isFinite(preScheduleLeadMs) || preScheduleLeadMs < 0) {
    preScheduleLeadMs = 0;
  }

  if (isConsoleReplay) {
    const minLead = CONSOLE_REPLAY_MIN_AUDIO_START_LEAD_MS;
    if (displayLeadMs < minLead) {
      displayLeadMs = minLead;
    }
    if (preScheduleLeadMs < minLead) {
      preScheduleLeadMs = minLead;
    }
  }

  return { preScheduleLeadMs, displayLeadMs };
};

function normalizeTimelineOffset(value?: number | null): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  if (value <= 0) {
    return null;
  }
  return value;
}

function applyTimelineOffset(requestedAt: number, timelineOffsetMs?: number | null): number {
  const offset = normalizeTimelineOffset(timelineOffsetMs);
  if (offset == null) {
    return requestedAt;
  }
  return requestedAt + offset;
}

type TorchScheduleOptions = {
  timelineOffsetMs?: number | null;
  source?: string;
  correlationId?: string | null;
  torchEnabled?: boolean;
};

function createKeyerOutputsHandle(initialOptions: KeyerOutputsOptions, context?: KeyerOutputsContext): KeyerOutputsHandle {
  let options: KeyerOutputsOptions = { ...initialOptions };
  const contextSource = context?.source ?? 'unspecified';
  const flashOpacity = new Animated.Value(0);
  const pressTracker = context?.pressTracker ?? createPressTracker(contextSource);
  let activePress: PressCorrelation | null = pressTracker.peek();
  const recordChannelLatency = (
    channel: 'touchToTone' | 'touchToHaptic' | 'touchToFlash' | 'touchToTorch',
    startedAt: number,
    latencyMs: number,
    overrides?: { source?: string; correlationId?: string; metadata?: Record<string, string | number | boolean> },
  ) => {
    const clamped = Math.max(0, latencyMs);
    const sampleSource = overrides?.source ?? contextSource;
    const correlationId = overrides?.correlationId ?? activePress?.id ?? null;
    recordLatencySample(channel, clamped, {
      requestedAt: startedAt,
      source: sampleSource,
      correlationId,
      metadata: overrides?.metadata ?? null,
    });
  };
  const toneController = createToneController();
  let hapticInterval: ReturnType<typeof setInterval> | null = null;
  let hapticsActive = false;
  let toneActive = false;
  let torchActive = false;
  let flashActive = false;
  let torchTimeout: ReturnType<typeof setTimeout> | null = null;
  let torchScheduleInfo: TorchScheduleOptions | null = null;
  let nativeFlashOwned = false;
  let nativeBrightnessBoostActive = false;

  const shouldWatchdog = contextSource.startsWith('console.');
  let pressWatchdog: ReturnType<typeof setTimeout> | null = null;

  function clearPressWatchdog(): void {
    if (pressWatchdog) {
      clearTimeout(pressWatchdog);
      pressWatchdog = null;
    }
  }

  function clearTorchTimeout(): void {
    if (torchTimeout) {
      clearTimeout(torchTimeout);
      torchTimeout = null;
    }
  }

  function cutActiveOutputs(
    reason = 'unspecified',
    metadata?: Record<string, string | number | boolean>,
  ): void {
    clearPressWatchdog();
    clearTorchTimeout();
    clearTorchTimeout();
    const forcedAt = nowMs();
    const currentPress = activePress;
    const holdMs = currentPress ? Math.max(0, forcedAt - currentPress.startedAtMs) : null;
    const correlationId = currentPress?.id ?? null;

    if (currentPress) {
      pressEnd(forcedAt);
    } else {
      flashOff(forcedAt);
      stopHaptics(forcedAt);
      if (torchActive) {
        disableTorch(forcedAt, { source: contextSource }).catch(() => {});
      }
      stopTone(forcedAt).catch(() => {});
      pressTracker.reset();
    }

    activePress = null;

    traceOutputs('keyer.forceCut', {
      reason,
      source: contextSource,
      correlationId,
      holdMs,
      metadata: metadata ?? null,
    });
  }

  function schedulePressWatchdog(startedAt: number): void {
    if (!shouldWatchdog) {
      return;
    }
    clearPressWatchdog();
    const scheduledCorrelationId = activePress?.id ?? null;
    pressWatchdog = setTimeout(() => {
      pressWatchdog = null;
      if (scheduledCorrelationId && activePress && activePress.id !== scheduledCorrelationId) {
        return;
      }
      const firedAt = nowMs();
      const holdMs = Math.max(0, firedAt - startedAt);
      const correlationId = activePress?.id ?? scheduledCorrelationId ?? null;
      traceOutputs('keyer.watchdog.pressTimeout', {
        source: contextSource,
        holdMs,
        correlationId,
        toneActive,
        flashActive,
        hapticsActive,
        torchActive,
      });
      const baseMetadata: Record<string, string | number | boolean> = {
        watchdog: 'pressTimeout',
        holdMs,
      };
      if (toneActive) {
        recordChannelLatency('touchToTone', startedAt, holdMs, {
          correlationId: correlationId ?? undefined,
          metadata: {
            ...baseMetadata,
            channel: 'tone',
          },
        });
      }
      if (flashActive) {
        recordChannelLatency('touchToFlash', startedAt, holdMs, {
          correlationId: correlationId ?? undefined,
          metadata: {
            ...baseMetadata,
            channel: 'flash',
          },
        });
      }
      cutActiveOutputs('watchdog.pressTimeout', {
        ...baseMetadata,
        toneActive,
        flashActive,
        hapticsActive,
        torchActive,
      });
    }, WATCHDOG_PRESS_TIMEOUT_MS);
  }

  const resolveToneHz = () => clampToneHz(options.toneHz);
  const resolveToneVolume = () => clampPercentToScalar(options.audioVolumePercent);
  const resolveFlashIntensity = () => clampPercentToScalar(options.flashBrightnessPercent);
  const resolveFlashBrightnessPercent = () => Math.max(0, Math.min(100, Math.round(options.flashBrightnessPercent)));

  const flashOn = (startedAt: number) => {
    if (!options.lightEnabled) {
      return;
    }
    flashActive = true;
    const intensity = resolveFlashIntensity();
    const brightnessPercent = resolveFlashBrightnessPercent();
    const latencyMs = nowMs() - startedAt;
    let nativeHandled = false;
    if (brightnessPercent > 0) {
      nativeHandled = setNativeFlashOverlayState(true, brightnessPercent);
      nativeFlashOwned = nativeHandled;
      if (nativeHandled) {
        if (options.screenBrightnessBoost && !nativeBrightnessBoostActive) {
          setNativeScreenBrightnessBoost(true);
          nativeBrightnessBoostActive = true;
        } else if (!options.screenBrightnessBoost && nativeBrightnessBoostActive) {
          setNativeScreenBrightnessBoost(false);
          nativeBrightnessBoostActive = false;
        }
      } else if (nativeBrightnessBoostActive) {
        setNativeScreenBrightnessBoost(false);
        nativeBrightnessBoostActive = false;
      }
    } else {
      nativeFlashOwned = false;
      if (nativeBrightnessBoostActive) {
        setNativeScreenBrightnessBoost(false);
        nativeBrightnessBoostActive = false;
      }
    }
    const latencyMetadata: Record<string, string | number | boolean> = { intensity };
    if (nativeHandled) {
      latencyMetadata.nativeOverlay = true;
    }
    traceOutputs('keyer.flash.start', {
      latencyMs,
      intensity,
      monotonicTimestampMs: startedAt,
      nativeOverlay: nativeHandled,
    });
    recordChannelLatency('touchToFlash', startedAt, latencyMs, {
      metadata: latencyMetadata,
    });
    if (nativeHandled) {
      try {
        flashOpacity.stopAnimation?.(() => {});
      } catch {
        // ignore
      }
      flashOpacity.setValue(0);
      return;
    }
    try {
      flashOpacity.stopAnimation?.(() => {});
    } catch {
      // ignore
    }
    Animated.timing(flashOpacity, {
      toValue: 1,
      duration: 0,
      useNativeDriver: true,
    }).start();
  };

  const flashOff = (endedAt: number) => {
    if (!flashActive) {
      return;
    }
    flashActive = false;
    const previouslyNative = nativeFlashOwned;
    if (nativeFlashOwned) {
      setNativeFlashOverlayState(false, resolveFlashBrightnessPercent());
      nativeFlashOwned = false;
    }
    if (nativeBrightnessBoostActive) {
      setNativeScreenBrightnessBoost(false);
      nativeBrightnessBoostActive = false;
    }
    if (!previouslyNative) {
      Animated.timing(flashOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }).start();
    } else {
      try {
        flashOpacity.stopAnimation?.(() => {});
      } catch {
        // ignore
      }
      flashOpacity.setValue(0);
    }
    traceOutputs('keyer.flash.stop', {
      latencyMs: nowMs() - endedAt,
      monotonicTimestampMs: endedAt,
      nativeOverlay: previouslyNative,
    });
  };

  const startHaptics = (startedAt: number) => {
    if (!options.hapticsEnabled || hapticsActive) return;
    hapticsActive = true;

    if (Platform.OS === 'android') {
      try {
        Vibration.cancel();
      } catch {
        // ignore
      }
      try {
        Vibration.vibrate(120000);
      } catch {
        // ignore
      }
      const latencyMs = nowMs() - startedAt;
      traceOutputs('keyer.haptics.start', {
        platform: 'android',
        latencyMs,
        monotonicTimestampMs: startedAt,
      });
      recordChannelLatency('touchToHaptic', startedAt, latencyMs);
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // ignore
    }

    if (hapticInterval) {
      clearInterval(hapticInterval);
      hapticInterval = null;
    }
    hapticInterval = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, 80);

    const latencyMs = nowMs() - startedAt;
    traceOutputs('keyer.haptics.start', {
      platform: 'ios',
      latencyMs,
      monotonicTimestampMs: startedAt,
    });
    recordChannelLatency('touchToHaptic', startedAt, latencyMs);
  };

  const stopHaptics = (endedAt: number) => {
    if (!hapticsActive) return;
    hapticsActive = false;

    if (Platform.OS === 'android') {
      try {
        Vibration.cancel();
      } catch {
        // ignore
      }
      traceOutputs('keyer.haptics.stop', {
        platform: 'android',
        latencyMs: nowMs() - endedAt,
        monotonicTimestampMs: endedAt,
      });
      return;
    }

    if (hapticInterval) {
      clearInterval(hapticInterval);
      hapticInterval = null;
    }
    traceOutputs('keyer.haptics.stop', {
      platform: 'ios',
      latencyMs: nowMs() - endedAt,
      monotonicTimestampMs: endedAt,
    });
  };

  const startTone = async (startedAt: number) => {
    if (!options.audioEnabled) return;
    const hz = resolveToneHz();
    const volume = resolveToneVolume();
    try {
      toneController.setVolume?.(volume);
      await toneController.start(hz);
      toneActive = true;
      const latencyMs = nowMs() - startedAt;
      traceOutputs('keyer.tone.start', {
        hz,
        volume,
        latencyMs,
        backend: toneController.backend,
        monotonicTimestampMs: startedAt,
      });
      recordChannelLatency('touchToTone', startedAt, latencyMs, {
        metadata: { backend: toneController.backend, hz, volume },
      });
    } catch (error) {
      toneActive = false;
      traceOutputs('keyer.tone.error', {
        message: error instanceof Error ? error.message : String(error),
        hz,
        backend: toneController.backend,
        phase: 'start',
      });
    }
  };

  const stopTone = async (endedAt: number) => {
    const wasActive = toneActive;
    toneActive = false;
    try {
      await toneController.stop();
      if (wasActive) {
        traceOutputs('keyer.tone.stop', {
          latencyMs: nowMs() - endedAt,
          backend: toneController.backend,
          monotonicTimestampMs: endedAt,
        });
      }
    } catch (error) {
      traceOutputs('keyer.tone.error', {
        message: error instanceof Error ? error.message : String(error),
        backend: toneController.backend,
        phase: 'stop',
      });
    }
  };

  async function enableTorch(startedAt: number, options?: TorchScheduleOptions) {
    const supported = isTorchAvailable();
    updateTorchSupport(supported);
    const torchAllowed = options?.torchEnabled ?? true;
    if (!torchAllowed || torchActive || !supported) return;
    torchActive = true;
    torchScheduleInfo = options ?? null;
    try {
      await acquireTorch();
      const normalizedOffset = normalizeTimelineOffset(options?.timelineOffsetMs);
      const effectiveStartedAt = applyTimelineOffset(startedAt, normalizedOffset);
      const latencyMs = nowMs() - effectiveStartedAt;
      traceOutputs('keyer.torch.start', {
        latencyMs,
        source: options?.source ?? contextSource,
        correlationId: options?.correlationId ?? null,
        timelineOffsetMs: normalizedOffset,
        monotonicTimestampMs: effectiveStartedAt,
      });
      recordChannelLatency('touchToTorch', effectiveStartedAt, latencyMs, {
        source: options?.source ?? undefined,
        correlationId: options?.correlationId ?? undefined,
        metadata: normalizedOffset != null ? { timelineOffsetMs: normalizedOffset } : undefined,
      });
      recordTorchPulse(latencyMs, 'keyer');
    } catch (error) {
      torchActive = false;
      recordTorchFailure(error instanceof Error ? error.message : String(error), 'keyer');
    }
  }

  async function disableTorch(endedAt: number, options?: TorchScheduleOptions) {
    if (!torchActive) return;
    const scheduleInfo = options ?? torchScheduleInfo ?? null;
    torchActive = false;
    torchScheduleInfo = null;
    let releaseFailed = false;
    let releaseMessage: string | null = null;
    const normalizedOffset = normalizeTimelineOffset(scheduleInfo?.timelineOffsetMs);
    const effectiveEndedAt = applyTimelineOffset(endedAt, normalizedOffset);
    try {
      await releaseTorch();
    } catch (error) {
      releaseFailed = true;
      releaseMessage = error instanceof Error ? error.message : String(error);
      recordTorchFailure(releaseMessage, 'keyer.release');
      traceOutputs('keyer.torch.error', {
        phase: 'release',
        message: releaseMessage,
      });
    }

    let forceOffFailed = false;
    let forceOffMessage: string | null = null;
    try {
      await forceTorchOff();
      traceOutputs('keyer.torch.reset', {
        reason: releaseFailed ? 'releaseFailed' : 'postReleaseSafety',
      });
    } catch (error) {
      forceOffFailed = true;
      forceOffMessage = error instanceof Error ? error.message : String(error);
      traceOutputs('keyer.torch.error', {
        phase: 'forceOff',
        message: forceOffMessage,
      });
      recordTorchFailure(forceOffMessage, 'keyer.forceOff');
    }

    traceOutputs('keyer.torch.stop', {
      latencyMs: Math.max(0, nowMs() - effectiveEndedAt),
      fallback: releaseFailed || forceOffFailed ? 'forceOff' : 'none',
      releaseFailed,
      releaseMessage,
      forceOffFailed,
      forceOffMessage,
      source: scheduleInfo?.source ?? contextSource,
      correlationId: scheduleInfo?.correlationId ?? null,
      timelineOffsetMs: normalizedOffset,
      monotonicTimestampMs: effectiveEndedAt,
    });
  };

  const prepare = async () => {
    if (!options.audioEnabled) return;
    const hz = resolveToneHz();
    const startedAt = nowMs();
    traceOutputs('keyer.prepare', { hz });
    try {
      await toneController.prepare(hz);
      traceOutputs('keyer.prepare.complete', {
        hz,
        backend: toneController.backend,
        latencyMs: nowMs() - startedAt,
      });
    } catch (error) {
      traceOutputs('keyer.prepare.error', {
        hz,
        backend: toneController.backend,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const teardown = async () => {
    traceOutputs('keyer.teardown');
    clearPressWatchdog();
    clearTorchTimeout();
    stopHaptics(nowMs());
    if (hapticInterval) {
      clearInterval(hapticInterval);
      hapticInterval = null;
    }

    await stopTone(nowMs());
    try {
      await toneController.teardown();
    } catch (error) {
      traceOutputs('keyer.teardown.error', {
        backend: toneController.backend,
        message: error instanceof Error ? error.message : String(error),
      });
    }

    flashActive = false;
    try {
      flashOpacity.stopAnimation?.(() => {});
    } catch {
      // ignore
    }
    flashOpacity.setValue(0);
    if (nativeFlashOwned) {
      setNativeFlashOverlayState(false, resolveFlashBrightnessPercent());
      nativeFlashOwned = false;
    }
    if (nativeBrightnessBoostActive) {
      setNativeScreenBrightnessBoost(false);
      nativeBrightnessBoostActive = false;
    }

    await disableTorch(nowMs(), { source: contextSource }).catch(() => {});
    try {
      await forceTorchOff();
    } catch {
      // ignore
    }
  };

  const pressStart = (timestampMs?: number) => {
    const press = pressTracker.begin(typeof timestampMs === 'number' ? timestampMs : undefined);
    activePress = press;
    const startedAt = press.startedAtMs;
    traceOutputs('keyer.press.start', {
      startedAt,
      source: contextSource,
      correlationId: press.id,
      options: {
        audio: options.audioEnabled,
        haptics: options.hapticsEnabled,
        light: options.lightEnabled,
        torch: options.torchEnabled,
        toneHz: resolveToneHz(),
      },
      monotonicTimestampMs: startedAt,
    });
    flashOn(startedAt);
    startHaptics(startedAt);
    if (options.torchEnabled) {
      const torchOptions: TorchScheduleOptions = {
        source: contextSource,
        correlationId: press.id,
        torchEnabled: true,
        timelineOffsetMs: null,
      };
      enableTorch(startedAt, torchOptions).catch(() => {});
    }
    startTone(startedAt).catch(() => {});
    schedulePressWatchdog(startedAt);
  };

  const pressEnd = (timestampMs?: number) => {
    clearPressWatchdog();
    clearTorchTimeout();
    const currentPress = activePress;
    const completed = pressTracker.end(typeof timestampMs === 'number' ? timestampMs : undefined);
    activePress = null;
    const endedAt =
      completed?.endedAtMs ??
      (typeof timestampMs === 'number' ? normalizePressTimestamp(timestampMs) : nowMs());
    const holdMs =
      completed?.holdDurationMs ??
      (currentPress ? Math.max(0, endedAt - currentPress.startedAtMs) : undefined);
    traceOutputs('keyer.press.stop', {
      endedAt,
      holdMs,
      source: contextSource,
      correlationId: currentPress?.id ?? null,
      monotonicTimestampMs: endedAt,
    });
    flashOff(endedAt);
    stopHaptics(endedAt);
    if (torchActive) {
      disableTorch(endedAt, { source: contextSource, correlationId: currentPress?.id ?? null }).catch(() => {});
    }
    stopTone(endedAt).catch(() => {});
  };

  const updateOptions = (next: KeyerOutputsOptions) => {
    options = { ...next };
    if (options.audioEnabled) {
      toneController.setVolume?.(resolveToneVolume());
    }
    if (!options.audioEnabled) {
      stopTone(nowMs()).catch(() => {});
    }
    if (!options.hapticsEnabled) {
      stopHaptics(nowMs());
    }
    if (!options.lightEnabled) {
      flashActive = false;
      try {
        flashOpacity.stopAnimation?.(() => {});
      } catch {
        // ignore
      }
      flashOpacity.setValue(0);
      if (nativeFlashOwned) {
        setNativeFlashOverlayState(false, resolveFlashBrightnessPercent());
        nativeFlashOwned = false;
      }
      if (nativeBrightnessBoostActive) {
        setNativeScreenBrightnessBoost(false);
        nativeBrightnessBoostActive = false;
      }
    } else if (nativeFlashOwned) {
      const nextBrightness = resolveFlashBrightnessPercent();
      if (nextBrightness <= 0) {
        setNativeFlashOverlayState(false, nextBrightness);
        nativeFlashOwned = false;
      } else {
        setNativeFlashOverlayState(true, nextBrightness);
      }
      if (options.screenBrightnessBoost && !nativeBrightnessBoostActive) {
        setNativeScreenBrightnessBoost(true);
        nativeBrightnessBoostActive = true;
      } else if (!options.screenBrightnessBoost && nativeBrightnessBoostActive) {
        setNativeScreenBrightnessBoost(false);
        nativeBrightnessBoostActive = false;
      }
    } else if (!options.screenBrightnessBoost && nativeBrightnessBoostActive) {
      setNativeScreenBrightnessBoost(false);
      nativeBrightnessBoostActive = false;
    }
    if (!options.torchEnabled && torchActive) {
      disableTorch(nowMs(), { source: contextSource }).catch(() => {});
    }
  };

  return {
    flashOpacity,
    prepare,
    teardown,
    pressStart,
    pressEnd,
    updateOptions,
    cutActiveOutputs,
  };
}

const defaultOutputsService: OutputsService = {
  createFlashValue() {
    return new Animated.Value(0);
  },

  flashPulse({
    enabled,
    durationMs,
    flashValue,
    source,
    torchEnabled = false,
    brightnessPercent,
    requestedAtMs,
    timelineOffsetMs,
    correlationId,
    metadata,
  }: FlashPulseOptions) {
    const eventSource = source ?? 'unspecified';
    const resolvedBrightnessPercent =
      typeof brightnessPercent === 'number' && Number.isFinite(brightnessPercent)
        ? Math.max(0, Math.min(100, brightnessPercent))
        : null;
    const flashIntensity =
      resolvedBrightnessPercent != null ? Math.max(0, Math.min(1, resolvedBrightnessPercent / 100)) : 1;
    const isConsoleReplay = eventSource === 'console.replay';
    const audioStartMarginMs = isConsoleReplay
      ? CONSOLE_REPLAY_AUDIO_START_TARGET_MARGIN_MS
      : FLASH_AUDIO_START_TARGET_MARGIN_MS;
    let normalizedTimelineOffset = normalizeTimelineOffset(timelineOffsetMs);
    const baseMetadata: Record<string, string | number | boolean> = metadata ? { ...metadata } : {};
    const providedTimelineOffsetMs = normalizedTimelineOffset;
    const rawDispatchPhase = baseMetadata.dispatchPhase;
    const dispatchPhase =
      rawDispatchPhase === 'scheduled' || rawDispatchPhase === 'actual'
        ? rawDispatchPhase
        : 'actual';
    if (rawDispatchPhase !== undefined) {
      delete baseMetadata.dispatchPhase;
    }
    const hasNativeExpectedTimestamp =
      typeof baseMetadata.nativeExpectedTimestampMs === 'number' &&
      Number.isFinite(baseMetadata.nativeExpectedTimestampMs as number);
    if (normalizedTimelineOffset != null && hasNativeExpectedTimestamp) {
      normalizedTimelineOffset = null;
    }

    const nativeFlashHandled = baseMetadata.nativeFlashHandled === true;
    const nativeFlashAvailabilityRaw = baseMetadata.nativeFlashAvailable;
    const nativeFlashAvailable =
      nativeFlashAvailabilityRaw === true
        ? true
        : nativeFlashAvailabilityRaw === false
          ? false
          : null;

    if (!enabled) {
      if (pendingFlashPulseTimeout) {
        clearTimeout(pendingFlashPulseTimeout);
        pendingFlashPulseTimeout = null;
      }
      if (pendingFlashPulseFrame != null && caf) {
        caf(pendingFlashPulseFrame);
        pendingFlashPulseFrame = null;
      }
      return;
    }

    if (nativeFlashHandled && dispatchPhase === 'actual') {
      if (pendingFlashPulseTimeout) {
        clearTimeout(pendingFlashPulseTimeout);
        pendingFlashPulseTimeout = null;
      }
      if (pendingFlashPulseFrame != null && caf) {
        caf(pendingFlashPulseFrame);
        pendingFlashPulseFrame = null;
      }
      traceOutputs('outputs.flashPulse.nativeHandled', {
        durationMs,
        source: eventSource,
        dispatchPhase,
        correlationId: correlationId ?? null,
        flashIntensity,
        ...(resolvedBrightnessPercent != null ? { brightnessPercent: resolvedBrightnessPercent } : {}),
        ...(nativeFlashAvailable !== null ? { nativeFlashAvailable } : {}),
      });
      return;
    }

    if (!nativeFlashHandled && nativeFlashAvailable === false && dispatchPhase === 'actual') {
      traceOutputs('outputs.flashPulse.nativeFallback', {
        durationMs,
        source: eventSource,
        dispatchPhase,
        correlationId: correlationId ?? null,
        flashIntensity,
        reason: 'overlay-unavailable',
        ...(resolvedBrightnessPercent != null ? { brightnessPercent: resolvedBrightnessPercent } : {}),
      });
    }

    if (dispatchPhase === 'scheduled') {
      traceOutputs('outputs.flashPulse.scheduled', {
        enabled,
        durationMs,
        source: eventSource,
        dispatchPhase,
        correlationId: correlationId ?? null,
        timelineOffsetMs: normalizedTimelineOffset,
        ...(nativeFlashAvailable !== null ? { nativeFlashAvailable } : {}),
      });
      return;
    }

    const requestedAt =
      typeof requestedAtMs === 'number' && Number.isFinite(requestedAtMs) ? requestedAtMs : nowMs();
    let effectiveRequestedAt = applyTimelineOffset(requestedAt, normalizedTimelineOffset);
    let leadMs = FLASH_TIMELINE_LEAD_MS > 0 ? FLASH_TIMELINE_LEAD_MS : 0;
    const { fadeMs, holdMs } = computeFlashTimings(durationMs);
    const getNumericMetadata = (key: string): number | null => {
      const value = baseMetadata[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      return null;
    };
    const monotonicTimestampMs = getNumericMetadata('monotonicTimestampMs');
    const nativeTimestampFromMetadata = getNumericMetadata('nativeTimestampMs');
    const nativeActualTargetMs =
      monotonicTimestampMs != null
        ? monotonicTimestampMs
        : nativeTimestampFromMetadata != null
          ? toMonotonicTime(nativeTimestampFromMetadata)
          : null;
    let schedulingMode: 'timeline' | 'audio-start' =
      normalizedTimelineOffset != null ? 'timeline' : 'audio-start';
    let audioStartHeadroomMs: number | null = null;
    let smoothedHeadroomMs: number | null = null;
    let audioStartGuardReason: string | null = null;
    const shouldDispatchImmediately =
      dispatchPhase === 'actual' && isConsoleReplay && nativeActualTargetMs != null;

    if (normalizedTimelineOffset == null) {
      const expectedTimestampMs = getNumericMetadata('nativeExpectedTimestampMs');
      const nativeOffsetMs = getNumericMetadata('nativeOffsetMs');
      const nativeStartSkewMs = getNumericMetadata('nativeStartSkewMs');
      const nativeAgeMs = getNumericMetadata('nativeAgeMs');
      const hasNativeTimestamp = typeof baseMetadata['nativeTimestampMs'] === 'number';

      if (expectedTimestampMs != null) {
        effectiveRequestedAt = expectedTimestampMs;
        const targetForAudioStart = effectiveRequestedAt - leadMs;
        audioStartHeadroomMs = targetForAudioStart - nowMs();
        if (!isConsoleReplay && audioStartHeadroomMs < AUDIO_START_MIN_HEADROOM_MS) {
          audioStartGuardReason = 'headroom';
        } else if (
          nativeStartSkewMs != null &&
          Math.abs(nativeStartSkewMs) > AUDIO_START_MAX_NATIVE_SKEW_MS
        ) {
          audioStartGuardReason = 'skew';
        } else if (
          !isConsoleReplay &&
          nativeAgeMs != null &&
          nativeAgeMs > AUDIO_START_MAX_NATIVE_AGE_MS
        ) {
          audioStartGuardReason = 'age';
        } else if (!hasNativeTimestamp) {
          audioStartGuardReason = 'missing-native';
        }

        if (isConsoleReplay && audioStartGuardReason === 'headroom') {
          audioStartGuardReason = null;
        }

        const hasAudioStartHeadroom =
          audioStartHeadroomMs != null && audioStartHeadroomMs >= AUDIO_START_MIN_HEADROOM_MS;
        const nativeStartReliable =
          hasNativeTimestamp &&
          nativeStartSkewMs != null &&
          Math.abs(nativeStartSkewMs) <= AUDIO_START_MAX_NATIVE_SKEW_MS &&
          hasAudioStartHeadroom;

        if (nativeStartReliable) {
          audioStartGuardReason = null;
          if (audioStartHeadroomMs != null && audioStartHeadroomMs < 0) {
            audioStartHeadroomMs = 0;
          } else if (audioStartHeadroomMs == null) {
            audioStartHeadroomMs = 0;
          }
          normalizedTimelineOffset = null;
          schedulingMode = 'audio-start';
          leadMs = 0;
        }

        if (audioStartGuardReason) {
          normalizedTimelineOffset = AUDIO_START_FALLBACK_TIMELINE_MS;
          audioStartCompensationMs = 0;
          effectiveRequestedAt = applyTimelineOffset(requestedAt, normalizedTimelineOffset);
          schedulingMode = 'timeline';
        } else {
          schedulingMode = 'audio-start';
        }
      } else if (nativeOffsetMs != null) {
        normalizedTimelineOffset =
          (typeof providedTimelineOffsetMs === 'number' ? providedTimelineOffsetMs : null) ??
          nativeOffsetMs;
        effectiveRequestedAt = applyTimelineOffset(requestedAt, normalizedTimelineOffset);
        schedulingMode = 'timeline';
      } else {
        normalizedTimelineOffset =
          (typeof providedTimelineOffsetMs === 'number' ? providedTimelineOffsetMs : null) ??
          AUDIO_START_FALLBACK_TIMELINE_MS;
        effectiveRequestedAt = applyTimelineOffset(requestedAt, normalizedTimelineOffset);
        schedulingMode = 'timeline';
      }
    }

    let targetStart = effectiveRequestedAt - leadMs;
    let audioStartCompensationMs = 0;
    if (
      schedulingMode === 'audio-start' &&
      audioStartGuardReason === 'headroom' &&
      audioStartHeadroomMs != null
    ) {
      audioStartCompensationMs = Math.min(
        AUDIO_START_MAX_COMPENSATION_MS,
        Math.max(0, -audioStartHeadroomMs),
      );
      targetStart -= audioStartCompensationMs;
    }
    const schedulingNow = nowMs();
    if (schedulingMode === 'timeline' && audioStartGuardReason === 'headroom') {
      const fallbackOffset =
        normalizedTimelineOffset != null && Number.isFinite(normalizedTimelineOffset)
          ? normalizedTimelineOffset
          : AUDIO_START_FALLBACK_TIMELINE_MS;
      normalizedTimelineOffset = fallbackOffset;
      audioStartHeadroomMs = fallbackOffset;
      leadMs = FLASH_TIMELINE_LEAD_MS > 0 ? FLASH_TIMELINE_LEAD_MS : 0;
      effectiveRequestedAt = schedulingNow + fallbackOffset;
      targetStart = effectiveRequestedAt - leadMs;
      smoothedHeadroomMs = updateHeadroomEstimate(
        durationMs,
        audioStartHeadroomMs ?? 0,
        schedulingNow,
      );
    }
    if (targetStart < schedulingNow) {
      targetStart = schedulingNow;
      if (normalizedTimelineOffset == null) {
        effectiveRequestedAt = targetStart + leadMs;
        audioStartHeadroomMs = 0;
      }
    }

    let availableHeadroomMs = Math.max(
      0,
      smoothedHeadroomMs != null ? smoothedHeadroomMs : effectiveRequestedAt - schedulingNow,
    );

    if (shouldDispatchImmediately && nativeActualTargetMs != null) {
      normalizedTimelineOffset = null;
      audioStartGuardReason = null;
      audioStartHeadroomMs = 0;
      targetStart = nativeActualTargetMs;
      effectiveRequestedAt = nativeActualTargetMs;
      audioStartCompensationMs = 0;
      availableHeadroomMs = Math.max(0, nativeActualTargetMs - schedulingNow);
    }

    if (schedulingMode === 'audio-start' && !isConsoleReplay && availableHeadroomMs < AUDIO_START_MIN_HEADROOM_MS) {
      audioStartGuardReason = 'headroom';
      normalizedTimelineOffset = AUDIO_START_FALLBACK_TIMELINE_MS;
      audioStartCompensationMs = 0;
      leadMs = FLASH_TIMELINE_LEAD_MS > 0 ? FLASH_TIMELINE_LEAD_MS : 0;
      effectiveRequestedAt = schedulingNow + normalizedTimelineOffset;
      audioStartHeadroomMs = normalizedTimelineOffset;
      schedulingMode = 'timeline';
      targetStart = effectiveRequestedAt - leadMs;
      availableHeadroomMs = Math.max(0, effectiveRequestedAt - schedulingNow);
    }

    const adaptiveLeads = getFlashAdaptiveLeads(schedulingNow, schedulingMode, isConsoleReplay);
    let preScheduleLeadMs = adaptiveLeads.preScheduleLeadMs;
    let appliedDisplayLeadMs = adaptiveLeads.displayLeadMs;

    if (shouldDispatchImmediately) {
      preScheduleLeadMs = 0;
      appliedDisplayLeadMs = 0;
      leadMs = 0;
    }

    const maxDisplayLead = Math.max(
      0,
      availableHeadroomMs > audioStartMarginMs
        ? availableHeadroomMs - audioStartMarginMs
        : availableHeadroomMs,
    );
    if (appliedDisplayLeadMs > maxDisplayLead) {
      appliedDisplayLeadMs = maxDisplayLead;
    }
    if (appliedDisplayLeadMs < 0) {
      appliedDisplayLeadMs = 0;
    }

    const maxPreScheduleLead = availableHeadroomMs;
    if (preScheduleLeadMs > maxPreScheduleLead) {
      preScheduleLeadMs = maxPreScheduleLead;
    } else if (preScheduleLeadMs < 0) {
      preScheduleLeadMs = 0;
    }

    if (schedulingMode === 'audio-start' && appliedDisplayLeadMs > 0) {
      if (appliedDisplayLeadMs > leadMs) {
        leadMs = appliedDisplayLeadMs;
      }
      targetStart = effectiveRequestedAt - leadMs;
      const minTargetStart =
        schedulingNow + Math.max(0, Math.min(audioStartMarginMs, availableHeadroomMs));
      if (targetStart < minTargetStart) {
        targetStart = Math.min(effectiveRequestedAt, minTargetStart);
        effectiveRequestedAt = targetStart + leadMs;
        audioStartHeadroomMs = Math.max(0, targetStart - schedulingNow);
      }
    }

    const audioStartLeadForMetadata =
      schedulingMode === 'audio-start' && appliedDisplayLeadMs > 0 ? appliedDisplayLeadMs : 0;

    if (schedulingMode === 'timeline') {
      audioStartCompensationMs = 0;
      if ('audioStartCompensationMs' in baseMetadata) {
        delete baseMetadata.audioStartCompensationMs;
      }
    }

    const sampleMetadata: Record<string, string | number | boolean> = {
      durationMs,
      dispatchPhase,
      ...baseMetadata,
      ...(normalizedTimelineOffset != null
        ? { timelineOffsetMs: normalizedTimelineOffset }
        : {}),
      ...(leadMs > 0 ? { leadMs } : {}),
      schedulingMode,
      flashIntensity,
      ...(resolvedBrightnessPercent != null ? { brightnessPercent: resolvedBrightnessPercent } : {}),
    };
    if (audioStartLeadForMetadata > 0) {
      sampleMetadata.audioStartLeadMs = audioStartLeadForMetadata;
    }
    if (preScheduleLeadMs > 0) {
      sampleMetadata.preScheduleLeadMs = preScheduleLeadMs;
    }
    if (audioStartHeadroomMs != null) {
      sampleMetadata.audioStartHeadroomMs = audioStartHeadroomMs;
    }
    if (audioStartGuardReason) {
      sampleMetadata.audioStartGuard = audioStartGuardReason;
    }
    if (audioStartCompensationMs > 0) {
      sampleMetadata.audioStartCompensationMs = audioStartCompensationMs;
    }

    traceOutputs('outputs.flashPulse', {
      enabled,
      durationMs,
      source: eventSource,
      dispatchPhase,
      correlationId: correlationId ?? null,
      timelineOffsetMs: normalizedTimelineOffset,
      schedulingMode,
      flashIntensity,
      ...(resolvedBrightnessPercent != null ? { brightnessPercent: resolvedBrightnessPercent } : {}),
      ...(nativeFlashAvailable !== null ? { nativeFlashAvailable } : {}),
      ...(audioStartLeadForMetadata > 0 ? { audioStartLeadMs: audioStartLeadForMetadata } : {}),
      ...(preScheduleLeadMs > 0 ? { preScheduleLeadMs } : {}),
      ...(audioStartHeadroomMs != null ? { audioStartHeadroomMs } : {}),
      ...(audioStartGuardReason ? { audioStartGuard: audioStartGuardReason } : {}),
      ...(audioStartCompensationMs > 0 ? { audioStartCompensationMs } : {}),
    });

    const startSequence = () => {
      flashValue.setValue(flashIntensity);
      const commitAt = nowMs();
      const scheduleSkewMs = commitAt - targetStart;
      const latencyMs = Math.max(0, commitAt - effectiveRequestedAt);
      if (schedulingMode === 'audio-start') {
        recordFlashPreScheduleSkew(scheduleSkewMs);
      }
      const isReplaySource =
        typeof eventSource === 'string' && eventSource.toLowerCase().includes('replay');
      const shouldEnableTorch = torchEnabled && !isReplaySource;
      if (shouldEnableTorch) {
        const torchOptions: TorchScheduleOptions = {
          source: eventSource,
          correlationId: correlationId ?? null,
          timelineOffsetMs: normalizedTimelineOffset,
          torchEnabled: true,
        };
        enableTorch(commitAt, torchOptions).catch(() => {});
        clearTorchTimeout();
        const torchHoldDuration = Math.max(0, holdMs + fadeMs);
        torchTimeout = setTimeout(() => {
          disableTorch(nowMs(), torchOptions).catch(() => {});
        }, torchHoldDuration);
      }
      traceOutputs('outputs.flashPulse.commit', {
        durationMs,
        source: eventSource,
        dispatchPhase,
        correlationId: correlationId ?? null,
        latencyMs,
        timelineOffsetMs: normalizedTimelineOffset,
        leadMs,
        scheduleSkewMs,
        schedulingMode,
        flashIntensity,
        ...(resolvedBrightnessPercent != null ? { brightnessPercent: resolvedBrightnessPercent } : {}),
        ...(nativeFlashAvailable !== null ? { nativeFlashAvailable } : {}),
        ...(audioStartLeadForMetadata > 0
          ? { audioStartLeadMs: audioStartLeadForMetadata }
          : {}),
        ...(preScheduleLeadMs > 0 ? { preScheduleLeadMs } : {}),
        ...(audioStartHeadroomMs != null ? { audioStartHeadroomMs } : {}),
        ...(audioStartGuardReason ? { audioStartGuard: audioStartGuardReason } : {}),
        ...(audioStartCompensationMs > 0 ? { audioStartCompensationMs } : {}),
      });
      recordLatencySample('touchToFlash', latencyMs, {
        requestedAt: effectiveRequestedAt,
        source: eventSource,
        correlationId: correlationId ?? null,
        metadata: {
          ...sampleMetadata,
          scheduleSkewMs,
        },
      });
      Animated.sequence([
        Animated.delay(holdMs),
        Animated.timing(flashValue, {
          toValue: 0,
          duration: fadeMs,
          useNativeDriver: true,
        }),
      ]).start();
    };

    const dispatchStart = () => {
      if (typeof flashValue.stopAnimation === 'function') {
        flashValue.stopAnimation(() => {
          startSequence();
        });
      } else {
        startSequence();
      }
    };

    if (pendingFlashPulseTimeout) {
      clearTimeout(pendingFlashPulseTimeout);
      pendingFlashPulseTimeout = null;
    }
    if (pendingFlashPulseFrame != null && caf) {
      caf(pendingFlashPulseFrame);
      pendingFlashPulseFrame = null;
    }
    if (pendingTimelineFallback) {
      clearTimeout(pendingTimelineFallback);
      pendingTimelineFallback = null;
    }

    if (shouldDispatchImmediately && nativeActualTargetMs != null) {
      dispatchStart();
      return;
    }

    const beginDispatchLoop = () => {
      if (schedulingMode === 'timeline') {
        const delay = Math.max(0, targetStart - nowMs());
        if (delay <= 1) {
          dispatchStart();
          return;
        }
        pendingTimelineFallback = scheduleMonotonic(
          () => {
            pendingTimelineFallback = null;
            dispatchStart();
          },
          { offsetMs: delay },
        );
        if (pendingTimelineFallback == null) {
          dispatchStart();
        }
        return;
      }

      if (raf == null) {
        const poll = () => {
          const pollNow = nowMs();
          if (pollNow >= targetStart) {
            pendingFlashPulseTimeout = null;
            dispatchStart();
            return;
          }
          const wait = Math.min(8, Math.max(1, targetStart - pollNow));
          pendingFlashPulseTimeout = setTimeout(poll, wait);
        };
        poll();
        return;
      }

      if (nowMs() >= targetStart) {
        dispatchStart();
        return;
      }

      const rafLoop = () => {
        if (nowMs() >= targetStart) {
          pendingFlashPulseFrame = null;
          dispatchStart();
        } else {
          pendingFlashPulseFrame = raf(rafLoop);
        }
      };
      pendingFlashPulseFrame = raf(rafLoop);
    };

    const activationTarget = Math.max(schedulingNow, targetStart - preScheduleLeadMs);
    let activationDelayMs = Math.max(0, activationTarget - schedulingNow);
    const activationCheckNow = nowMs();
    if (activationCheckNow > schedulingNow) {
      activationDelayMs = Math.max(0, activationTarget - activationCheckNow);
    }

    const activate = () => {
      pendingFlashPulseTimeout = null;
      beginDispatchLoop();
    };

    if (activationDelayMs <= 1) {
      activate();
      return;
    }

    if (raf != null && activationDelayMs <= 16) {
      const waitForActivation = () => {
        if (nowMs() >= activationTarget) {
          pendingFlashPulseFrame = null;
          activate();
        } else {
          pendingFlashPulseFrame = raf(waitForActivation);
        }
      };
      pendingFlashPulseFrame = raf(waitForActivation);
      return;
    }

    pendingFlashPulseTimeout = setTimeout(() => {
      activate();
    }, activationDelayMs);
  },

  hapticSymbol({
    enabled,
    symbol,
    durationMs,
    source,
    requestedAtMs,
    timelineOffsetMs,
    correlationId,
    metadata,
  }: HapticSymbolOptions) {
    const eventSource = source ?? 'unspecified';
    const isConsoleReplay = eventSource === 'console.replay';
    const normalizedTimelineOffset = normalizeTimelineOffset(timelineOffsetMs);
    const dispatchPhase =
      metadata && typeof metadata.dispatchPhase === 'string' ? metadata.dispatchPhase : 'actual';
    traceOutputs('outputs.hapticSymbol', {
      enabled,
      symbol,
      durationMs: durationMs ?? null,
      platform: Platform.OS,
      source: eventSource,
      correlationId: correlationId ?? null,
      timelineOffsetMs: normalizedTimelineOffset,
      dispatchPhase,
    });

    if (!enabled || dispatchPhase === 'scheduled') return;

    const requestedAt =
      typeof requestedAtMs === 'number' && Number.isFinite(requestedAtMs) ? requestedAtMs : nowMs();
    const effectiveRequestedAt = applyTimelineOffset(requestedAt, normalizedTimelineOffset);
    const baseMetadata: Record<string, string | number | boolean> = {
      ...(metadata ?? {}),
      symbol,
      ...(normalizedTimelineOffset != null
        ? { timelineOffsetMs: normalizedTimelineOffset }
        : {}),
    };

    let recorded = false;
    const recordOnce = (extra?: Record<string, string | number | boolean>) => {
      if (recorded) return;
      recorded = true;
      const commitAt = nowMs();
      const latencyMs = Math.max(0, commitAt - effectiveRequestedAt);
      recordLatencySample('touchToHaptic', latencyMs, {
        requestedAt: effectiveRequestedAt,
        source: eventSource,
        correlationId: correlationId ?? null,
        metadata: { ...baseMetadata, ...(extra ?? {}) },
      });
    };

    if (Platform.OS === 'android') {
      if (playbackVibrationState.timeout) {
        clearTimeout(playbackVibrationState.timeout);
        playbackVibrationState.timeout = null;
      }
      if (typeof durationMs === 'number') {
        const baseDuration = Math.max(20, durationMs);
        const extra = symbol === '-' ? 40 : 20;
        const minDuration = symbol === '-' ? 140 : 50;
        const maxDuration = symbol === '-' ? 360 : 180;
        const targetDuration = Math.max(
          minDuration,
          Math.min(Math.round(baseDuration + extra), maxDuration),
        );

        try {
          Vibration.cancel();
        } catch {
          // ignore
        }
        let vibrated = false;
        try {
          Vibration.vibrate([0, targetDuration]);
          vibrated = true;
        } catch {
          // ignore
        }
        if (!vibrated) {
          try {
            Vibration.vibrate(targetDuration);
            vibrated = true;
          } catch {
            // ignore
          }
        }
        playbackVibrationState.timeout = setTimeout(() => {
          try {
            Vibration.cancel();
          } catch {
            // ignore
          }
          playbackVibrationState.timeout = null;
        }, targetDuration + 40);
        recordOnce({
          dispatch: 'vibration',
          pulseMs: targetDuration,
          symbol,
          requestedDurationMs: durationMs,
        });
        return;
      }
    }

    const style = symbol === '-' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;

    try {
      const promise = Haptics.impactAsync(style);
      let fallback: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        recordOnce({ dispatch: 'impactAsync', style, fallback: true });
        fallback = null;
      }, 120);
      if (promise && typeof promise.then === 'function') {
        promise
          .then(() => {
            if (fallback) {
              clearTimeout(fallback);
              fallback = null;
            }
            recordOnce({ dispatch: 'impactAsync', style });
          })
          .catch(() => {
            if (fallback) {
              clearTimeout(fallback);
              fallback = null;
            }
            recordOnce({ dispatch: 'impactAsync', style, rejected: true });
          });
      } else {
        if (fallback) {
          clearTimeout(fallback);
          fallback = null;
        }
        recordOnce({ dispatch: 'impactSync', style });
      }
    } catch {
      recordOnce({ dispatch: 'impactAsync', style, rejected: true });
    }
  },

  async playMorse({
    morse,
    unitMs,
    onSymbolStart,
    source,
    audioEnabled,
    audioVolumePercent,
    flashEnabled,
    hapticsEnabled,
    torchEnabled,
    flashBrightnessPercent,
    screenBrightnessBoost,
  }: PlayMorseOptions) {
    const playbackSource = source ?? 'replay';
    const resolvedAudioEnabled = audioEnabled ?? true;
    const resolvedVolumePercent = clampVolumePercent(audioVolumePercent);
    const volumeScalar = clampPercentToScalar(resolvedVolumePercent);
    const effectiveAudioEnabled = resolvedAudioEnabled && volumeScalar > 0;
    const resolvedFlashEnabled = flashEnabled ?? false;
    const resolvedHapticsEnabled = hapticsEnabled ?? false;
    const resolvedTorchEnabled = torchEnabled ?? false;
    const resolvedFlashBrightness = flashBrightnessPercent ?? 0;
    const resolvedScreenBrightnessBoost = screenBrightnessBoost ?? false;
    const startedAt = nowMs();
    traceOutputs('playMorse.start', {
      unitMs,
      length: morse.length,
      source: playbackSource,
      audioEnabled: resolvedAudioEnabled,
      audioVolumePercent: resolvedVolumePercent,
      flashEnabled: resolvedFlashEnabled,
      hapticsEnabled: resolvedHapticsEnabled,
      torchEnabled: resolvedTorchEnabled,
      screenBrightnessBoost: resolvedScreenBrightnessBoost,
    });

    let symbolIndex = 0;
    const symbolTracker = (symbol: '.' | '-', durationMs: number, native?: NativeSymbolTimingContext) => {
      const dispatchPhase = native?.dispatchPhase ?? 'actual';
      const correlation = createPressCorrelation(playbackSource);
      const requestedAtMs =
        (typeof native?.requestedAtMs === 'number' && Number.isFinite(native.requestedAtMs)
          ? native.requestedAtMs
          : correlation.startedAtMs);
      correlation.startedAtMs = requestedAtMs;
      const nativeTimestampMs = native?.nativeTimestampMs ?? null;
      const nativeDurationMs = native?.nativeDurationMs ?? null;
      const nativeOffsetMs = native?.nativeOffsetMs ?? null;
      const nativeSequence = native?.nativeSequence ?? null;
      const nativeExpectedTimestampMs = native?.nativeExpectedTimestampMs ?? null;
      const nativeStartSkewMs = native?.nativeStartSkewMs ?? null;
      const nativeBatchElapsedMs = native?.nativeBatchElapsedMs ?? null;
      const nativeExpectedSincePriorMs = native?.nativeExpectedSincePriorMs ?? null;
      const nativeSincePriorMs = native?.nativeSincePriorMs ?? null;
      const nativePatternStartMs = native?.nativePatternStartMs ?? null;
      const nativeAgeMs = native?.nativeAgeMs ?? null;
      const monotonicTimestampMs =
        native?.monotonicTimestampMs ??
        (nativeTimestampMs != null ? toMonotonicTime(nativeTimestampMs) : null);
      const correlationId = native?.correlationId ?? correlation.id;
      const contextPayload = {
        requestedAtMs,
        correlationId,
        source: native?.source ?? playbackSource,
        dispatchPhase,
        nativeTimestampMs,
        nativeDurationMs,
        nativeOffsetMs,
        nativeSequence,
        monotonicTimestampMs,
        nativeExpectedTimestampMs,
        nativeStartSkewMs,
        nativeBatchElapsedMs,
        nativeExpectedSincePriorMs,
        nativeSincePriorMs,
        nativePatternStartMs,
        nativeAgeMs,
        nativeFlashHandled: native?.nativeFlashHandled ?? null,
        nativeFlashAvailable: native?.nativeFlashAvailable ?? null,
      };
      if (dispatchPhase === 'scheduled') {
        onSymbolStart?.(symbol, durationMs, contextPayload);
        return;
      }
      traceOutputs('playMorse.symbol', {
        symbol,
        durationMs,
        index: symbolIndex,
        source: playbackSource,
        correlationId,
        nativeTimestampMs,
        nativeDurationMs,
        nativeOffsetMs,
        nativeSequence,
        monotonicTimestampMs,
        nativeExpectedTimestampMs,
        nativeStartSkewMs,
        nativeBatchElapsedMs,
        nativeExpectedSincePriorMs,
        nativeSincePriorMs,
        nativePatternStartMs,
        nativeAgeMs,
        nativeFlashHandled: contextPayload.nativeFlashHandled ?? null,
        nativeFlashAvailable: contextPayload.nativeFlashAvailable ?? null,
      });
      if (nativeOffsetMs != null && Math.abs(nativeOffsetMs) >= NATIVE_OFFSET_SPIKE_THRESHOLD_MS) {
        const spikePayload: Record<string, unknown> = {
          source: playbackSource,
          offsetMs: nativeOffsetMs,
          sequence: nativeSequence,
          unitMs,
          correlationId,
        };
        if (nativeStartSkewMs != null) {
          spikePayload.startSkewMs = nativeStartSkewMs;
        }
        if (nativeBatchElapsedMs != null) {
          spikePayload.batchElapsedMs = nativeBatchElapsedMs;
        }
        if (nativeAgeMs != null) {
          spikePayload.ageMs = nativeAgeMs;
        }
        traceOutputs('playMorse.nativeOffset.spike', spikePayload);
      }
      symbolIndex += 1;
      onSymbolStart?.(symbol, durationMs, contextPayload);
    };

    try {
      await playMorseCode(morse, unitMs, {
        onSymbolStart: symbolTracker,
        audioEnabled: effectiveAudioEnabled,
        audioVolumePercent: resolvedVolumePercent,
        source: playbackSource,
        flashEnabled: resolvedFlashEnabled,
        hapticsEnabled: resolvedHapticsEnabled,
        torchEnabled: resolvedTorchEnabled,
        flashBrightnessPercent: resolvedFlashBrightness,
        screenBrightnessBoost: resolvedScreenBrightnessBoost,
      });
      traceOutputs('playMorse.complete', {
        durationMs: nowMs() - startedAt,
        source: playbackSource,
        audioEnabled: resolvedAudioEnabled,
        audioVolumePercent: resolvedVolumePercent,
        screenBrightnessBoost: resolvedScreenBrightnessBoost,
      });
    } catch (error) {
      traceOutputs('playMorse.error', {
        message: error instanceof Error ? error.message : String(error),
        source: playbackSource,
        audioEnabled: resolvedAudioEnabled,
        audioVolumePercent: resolvedVolumePercent,
        screenBrightnessBoost: resolvedScreenBrightnessBoost,
      });
      throw error;
    }
  },

  stopMorse() {
    stopPlayback();
  },

  createKeyerOutputs(options: KeyerOutputsOptions, context?: KeyerOutputsContext) {
    return createKeyerOutputsHandle(options, context);
  },

  isTorchSupported() {
    return isTorchAvailable();
  },
};

export { defaultOutputsService };
































