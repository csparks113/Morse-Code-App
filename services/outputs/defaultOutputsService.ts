import { Animated, Platform, Vibration } from 'react-native';
import { Audio } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';

import { playMorseCode, stopPlayback } from '@/utils/audio';
import { acquireTorch, releaseTorch, resetTorch, isTorchAvailable } from '@/utils/torch';
import { nowMs } from '@/utils/time';
import { traceOutputs } from './trace';
import { updateTorchSupport, recordTorchPulse, recordTorchFailure } from '@/store/useOutputsDiagnosticsStore';
import { recordLatencySample } from '@/store/useOutputsLatencyStore';
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

function bytesToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i] ?? 0;
    const b2 = bytes[i + 1];
    const b3 = bytes[i + 2];
    const e1 = b1 >> 2;
    const e2 = ((b1 & 3) << 4) | ((b2 ?? 0) >> 4);
    const e3 = b2 !== undefined ? (((b2 & 15) << 2) | ((b3 ?? 0) >> 6)) : 64;
    const e4 = b3 !== undefined ? (b3 & 63) : 64;
    out += chars.charAt(e1) + chars.charAt(e2) + chars.charAt(e3) + chars.charAt(e4);
  }
  return out;
}

function generateLoopingSineWav(
  frequency: number,
  opts?: { sampleRate?: number; cycles?: number; amplitude?: number },
): Uint8Array {
  const sampleRate = opts?.sampleRate ?? 44100;
  const amplitude = Math.max(0, Math.min(1, opts?.amplitude ?? 0.28));
  const periodSamples = Math.max(1, Math.round(sampleRate / frequency));
  const cycles = opts?.cycles ?? 2000;
  const totalSamples = periodSamples * cycles;

  const bytesPerSample = 2;
  const dataSize = totalSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const rampIn = Math.min(128, Math.floor(totalSamples * 0.002));
  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / sampleRate;
    const s = Math.sin(2 * Math.PI * (sampleRate / periodSamples) * t);
    const env = i < rampIn ? i / rampIn : 1;
    const val = (Math.max(-1, Math.min(1, s)) * amplitude * env * 32767) | 0;
    view.setInt16(offset, val, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

function createKeyerOutputsHandle(initialOptions: KeyerOutputsOptions, context?: KeyerOutputsContext): KeyerOutputsHandle {
  let options: KeyerOutputsOptions = { ...initialOptions };
  const contextSource = context?.source ?? 'unspecified';
  const flashOpacity = new Animated.Value(0);
  const recordChannelLatency = (channel: 'touchToTone' | 'touchToHaptic' | 'touchToFlash' | 'touchToTorch', startedAt: number, latencyMs: number) => {
    const clamped = Math.max(0, latencyMs);
    recordLatencySample(channel, clamped, { requestedAt: startedAt, source: contextSource });
  };
  let sound: Audio.Sound | null = null;
  let preparedToneHz: number | null = null;
  let hapticInterval: ReturnType<typeof setInterval> | null = null;
  let hapticsActive = false;
  let toneActive = false;
  let torchActive = false;
  let flashActive = false;
  let pressStartedAt: number | null = null;

  const ensureAudioMode = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });
    } catch {
      // ignore
    }
  };

  const resolveToneHz = () => clampToneHz(options.toneHz);

  const prepareTone = async (hz: number) => {
    if (preparedToneHz === hz && sound) {
      return;
    }

    try {
      await sound?.unloadAsync();
    } catch {
      // ignore
    }
    sound = null;
    preparedToneHz = null;

    await ensureAudioMode();

    const wav = generateLoopingSineWav(hz, { cycles: 2000, amplitude: 0.28 });
    const base64 = bytesToBase64(wav);
    const dir = `${FileSystem.cacheDirectory ?? ''}morse-keyer/`;
    try {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true } as any);
    } catch {
      // ignore
    }
    const uri = `${dir}keyer_${hz}.wav`;
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: 'base64' as any });

    const created = await Audio.Sound.createAsync({ uri });
    sound = created.sound;
    preparedToneHz = hz;
    try {
      await sound.setIsLoopingAsync(true);
    } catch {
      // ignore
    }
  };

  const flashOn = (startedAt: number) => {
    if (!options.lightEnabled) return;
    flashActive = true;
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
    });
    recordChannelLatency('touchToFlash', startedAt, latencyMs);
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
    await prepareTone(hz);
    try {
      await sound?.setPositionAsync(0);
      await sound?.playAsync();
      toneActive = true;
      const latencyMs = nowMs() - startedAt;
      traceOutputs('keyer.tone.start', {
        hz,
        latencyMs,
      });
      recordChannelLatency('touchToTone', startedAt, latencyMs);
    } catch {
      toneActive = false;
    }
  };

  const stopTone = async (endedAt: number) => {
    if (!sound || !toneActive) return;
    toneActive = false;
    try {
      await sound.stopAsync();
      await sound.setPositionAsync(0);
      traceOutputs('keyer.tone.stop', {
        latencyMs: nowMs() - endedAt,
      });
    } catch {
      // ignore
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
    traceOutputs('keyer.prepare', { hz });
    await prepareTone(hz);
  };

  const teardown = async () => {
    traceOutputs('keyer.teardown');
    stopHaptics(nowMs());
    if (hapticInterval) {
      clearInterval(hapticInterval);
      hapticInterval = null;
    }

    await stopTone(nowMs());
    try {
      await sound?.unloadAsync();
    } catch {
      // ignore
    }
    sound = null;
    preparedToneHz = null;

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
    const startedAt = typeof timestampMs === 'number' ? timestampMs : nowMs();
    pressStartedAt = startedAt;
    traceOutputs('keyer.press.start', {
      startedAt,
      source: contextSource,
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
  };

  const pressEnd = (timestampMs?: number) => {
    const endedAt = typeof timestampMs === 'number' ? timestampMs : nowMs();
    const holdMs = pressStartedAt != null ? Math.max(0, endedAt - pressStartedAt) : undefined;
    pressStartedAt = null;
    traceOutputs('keyer.press.stop', {
      endedAt,
      holdMs,
      source: contextSource,
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
  };
}

const defaultOutputsService: OutputsService = {
  createFlashValue() {
    return new Animated.Value(0);
  },

  flashPulse({ enabled, durationMs, flashValue, source }: FlashPulseOptions) {
    traceOutputs('outputs.flashPulse', {
      enabled,
      durationMs,
      source: source ?? 'unspecified',
    });

    if (!enabled) return;
    const { fadeMs, holdMs } = computeFlashTimings(durationMs);

    flashValue.stopAnimation?.(() => {
      flashValue.setValue(1);
      Animated.sequence([
        Animated.delay(holdMs),
        Animated.timing(flashValue, {
          toValue: 0,
          duration: fadeMs,
          useNativeDriver: true,
        }),
      ]).start();
    });
  },

  hapticSymbol({ enabled, symbol, durationMs, source }: HapticSymbolOptions) {
    traceOutputs('outputs.hapticSymbol', {
      enabled,
      symbol,
      durationMs: durationMs ?? null,
      platform: Platform.OS,
      source: source ?? 'unspecified',
    });

    if (!enabled) return;
    if (!enabled) return;

    if (Platform.OS === 'android' && typeof durationMs === 'number') {
      try {
        Vibration.cancel();
      } catch {
        // ignore
      }
      const pulse = Math.max(15, Math.round(durationMs));
      Vibration.vibrate(pulse);
      return;
    }

    const style = symbol === '-' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
    Haptics.impactAsync(style).catch(() => {});
  },

  async playMorse({ morse, unitMs, onSymbolStart }: PlayMorseOptions) {
    const startedAt = nowMs();
    traceOutputs('playMorse.start', {
      unitMs,
      length: morse.length,
    });

    let symbolIndex = 0;
    const symbolTracker = (symbol: '.' | '-', durationMs: number) => {
      traceOutputs('playMorse.symbol', {
        symbol,
        durationMs,
        index: symbolIndex,
      });
      symbolIndex += 1;
      onSymbolStart?.(symbol, durationMs);
    };

    try {
      await playMorseCode(morse, unitMs, { onSymbolStart: symbolTracker });
      traceOutputs('playMorse.complete', {
        durationMs: nowMs() - startedAt,
      });
    } catch (error) {
      traceOutputs('playMorse.error', {
        message: error instanceof Error ? error.message : String(error),
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
