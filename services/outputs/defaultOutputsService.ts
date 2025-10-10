import { Animated, Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

import { playMorseCode, stopPlayback, createToneController } from '@/utils/audio';
import type { NativeSymbolTimingContext } from '@/utils/audio';
import { acquireTorch, releaseTorch, resetTorch, isTorchAvailable } from '@/utils/torch';
import { nowMs } from '@/utils/time';
import { traceOutputs } from './trace';
import { updateTorchSupport, recordTorchPulse, recordTorchFailure } from '@/store/useOutputsDiagnosticsStore';
import { recordLatencySample } from '@/store/useOutputsLatencyStore';
import { createPressCorrelation, createPressTracker, normalizePressTimestamp, type PressCorrelation } from '@/services/latency/pressTracker';
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

  const shouldWatchdog = contextSource.startsWith('console.');
  let pressWatchdog: ReturnType<typeof setTimeout> | null = null;

  function clearPressWatchdog(): void {
    if (pressWatchdog) {
      clearTimeout(pressWatchdog);
      pressWatchdog = null;
    }
  }

  function cutActiveOutputs(
    reason = 'unspecified',
    metadata?: Record<string, string | number | boolean>,
  ): void {
    clearPressWatchdog();
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
        disableTorch(forcedAt).catch(() => {});
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

  const flashOn = (startedAt: number) => {
    if (!options.lightEnabled) return;
    flashActive = true;
    const intensity = resolveFlashIntensity();
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
    const latencyMs = nowMs() - startedAt;
    traceOutputs('keyer.flash.start', {
      latencyMs,
      intensity,
    });
    recordChannelLatency('touchToFlash', startedAt, latencyMs, {
      metadata: { intensity },
    });
  };

  const flashOff = (endedAt: number) => {
    if (!flashActive) return;
    flashActive = false;
    Animated.timing(flashOpacity, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start();
    traceOutputs('keyer.flash.stop', {
      latencyMs: nowMs() - endedAt,
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

  const enableTorch = async (startedAt: number) => {
    const supported = isTorchAvailable();
    updateTorchSupport(supported);
    if (!options.torchEnabled || torchActive || !supported) return;
    torchActive = true;
    try {
      await acquireTorch();
      const latencyMs = nowMs() - startedAt;
      traceOutputs('keyer.torch.start', {
        latencyMs,
      });
      recordChannelLatency('touchToTorch', startedAt, latencyMs);
      recordTorchPulse(latencyMs, 'keyer');
    } catch (error) {
      torchActive = false;
      recordTorchFailure(error instanceof Error ? error.message : String(error), 'keyer');
    }
  };

  const disableTorch = async (endedAt: number) => {
    if (!torchActive) return;
    torchActive = false;
    try {
      await releaseTorch();
    } catch {
      // ignore
    }
    traceOutputs('keyer.torch.stop', {
      latencyMs: nowMs() - endedAt,
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

    if (torchActive) {
      torchActive = false;
      try {
        await releaseTorch();
      } catch {
        // ignore
      }
    }
    try {
      await resetTorch();
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
    });
    flashOn(startedAt);
    startHaptics(startedAt);
    if (options.torchEnabled) {
      enableTorch(startedAt).catch(() => {});
    }
    startTone(startedAt).catch(() => {});
    schedulePressWatchdog(startedAt);
  };

  const pressEnd = (timestampMs?: number) => {
    clearPressWatchdog();
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
    });
    flashOff(endedAt);
    stopHaptics(endedAt);
    if (torchActive) {
      disableTorch(endedAt).catch(() => {});
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
    }
    if (!options.torchEnabled && torchActive) {
      disableTorch(nowMs()).catch(() => {});
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

  flashPulse({ enabled, durationMs, flashValue, source, requestedAtMs, correlationId, metadata }: FlashPulseOptions) {
    const eventSource = source ?? 'unspecified';
    traceOutputs('outputs.flashPulse', {
      enabled,
      durationMs,
      source: eventSource,
      correlationId: correlationId ?? null,
    });

    if (!enabled) return;

    const requestedAt =
      typeof requestedAtMs === 'number' && Number.isFinite(requestedAtMs) ? requestedAtMs : nowMs();
    const sampleMetadata = { durationMs, ...(metadata ?? {}) };
    const { fadeMs, holdMs } = computeFlashTimings(durationMs);

    const startSequence = () => {
      flashValue.setValue(1);
      const commitAt = nowMs();
      const latencyMs = Math.max(0, commitAt - requestedAt);
      traceOutputs('outputs.flashPulse.commit', {
        durationMs,
        source: eventSource,
        correlationId: correlationId ?? null,
        latencyMs,
      });
      recordLatencySample('touchToFlash', latencyMs, {
        requestedAt,
        source: eventSource,
        correlationId: correlationId ?? null,
        metadata: sampleMetadata,
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

    if (typeof flashValue.stopAnimation === 'function') {
      flashValue.stopAnimation(() => {
        startSequence();
      });
      return;
    }

    startSequence();
  },

  hapticSymbol({
    enabled,
    symbol,
    durationMs,
    source,
    requestedAtMs,
    correlationId,
    metadata,
  }: HapticSymbolOptions) {
    const eventSource = source ?? 'unspecified';
    traceOutputs('outputs.hapticSymbol', {
      enabled,
      symbol,
      durationMs: durationMs ?? null,
      platform: Platform.OS,
      source: eventSource,
      correlationId: correlationId ?? null,
    });

    if (!enabled) return;

    const requestedAt =
      typeof requestedAtMs === 'number' && Number.isFinite(requestedAtMs) ? requestedAtMs : nowMs();
    const baseMetadata: Record<string, string | number | boolean> = {
      ...(metadata ?? {}),
      symbol,
    };

    let recorded = false;
    const recordOnce = (extra?: Record<string, string | number | boolean>) => {
      if (recorded) return;
      recorded = true;
      const commitAt = nowMs();
      const latencyMs = Math.max(0, commitAt - requestedAt);
      recordLatencySample('touchToHaptic', latencyMs, {
        requestedAt,
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

  async playMorse({ morse, unitMs, onSymbolStart, source, audioEnabled, audioVolumePercent }: PlayMorseOptions) {
    const playbackSource = source ?? 'replay';
    const resolvedAudioEnabled = audioEnabled ?? true;
    const resolvedVolumePercent = clampVolumePercent(audioVolumePercent);
    const volumeScalar = clampPercentToScalar(resolvedVolumePercent);
    const effectiveAudioEnabled = resolvedAudioEnabled && volumeScalar > 0;
    const startedAt = nowMs();
    traceOutputs('playMorse.start', {
      unitMs,
      length: morse.length,
      source: playbackSource,
      audioEnabled: resolvedAudioEnabled,
      audioVolumePercent: resolvedVolumePercent,
    });

    let symbolIndex = 0;
    const symbolTracker = (symbol: '.' | '-', durationMs: number, native?: NativeSymbolTimingContext) => {
      const correlation = createPressCorrelation(playbackSource);
      const nativeTimestampMs = native?.nativeTimestampMs ?? null;
      const nativeDurationMs = native?.nativeDurationMs ?? null;
      const nativeOffsetMs = native?.nativeOffsetMs ?? null;
      const nativeSequence = native?.nativeSequence ?? null;
      traceOutputs('playMorse.symbol', {
        symbol,
        durationMs,
        index: symbolIndex,
        source: playbackSource,
        correlationId: correlation.id,
        nativeTimestampMs,
        nativeDurationMs,
        nativeOffsetMs,
        nativeSequence,
      });
      symbolIndex += 1;
      onSymbolStart?.(symbol, durationMs, {
        requestedAtMs: correlation.startedAtMs,
        correlationId: correlation.id,
        source: playbackSource,
        nativeTimestampMs,
        nativeDurationMs,
        nativeOffsetMs,
        nativeSequence,
      });
    };

    try {
      await playMorseCode(morse, unitMs, {
        onSymbolStart: symbolTracker,
        audioEnabled: effectiveAudioEnabled,
        audioVolumePercent: resolvedVolumePercent,
      });
      traceOutputs('playMorse.complete', {
        durationMs: nowMs() - startedAt,
        source: playbackSource,
        audioEnabled: resolvedAudioEnabled,
        audioVolumePercent: resolvedVolumePercent,
      });
    } catch (error) {
      traceOutputs('playMorse.error', {
        message: error instanceof Error ? error.message : String(error),
        source: playbackSource,
        audioEnabled: resolvedAudioEnabled,
        audioVolumePercent: resolvedVolumePercent,
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

























