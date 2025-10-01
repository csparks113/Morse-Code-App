import React from "react";
import { Animated, Platform, Vibration } from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import {
  acquireTorch,
  releaseTorch,
  resetTorch,
  isTorchAvailable,
} from "@/utils/torch";

type UseKeyerOutputsOptions = {
  audioEnabled: boolean;   // play a continuous sidetone while the keyer is held
  hapticsEnabled: boolean; // vibrate / haptic feedback while the keyer is held
  lightEnabled: boolean;   // show a fullscreen flash overlay while held
  torchEnabled: boolean;   // toggle the physical flashlight while held
  toneHz: number;          // sidetone frequency in Hz (e.g., 600)
};

type UseKeyerOutputsResult = {
  onDown: () => void;                 // call on keyer press-in (starts outputs)
  onUp: () => void;                   // call on keyer release (stops outputs)
  flashOpacity: Animated.Value;       // 0..1 opacity for the flash overlay
  prepare: () => Promise<void>;       // warm-up: set audio mode & prebuild tone
  teardown: () => Promise<void>;      // cleanup: stop/unload audio, stop haptics
};

const DEFAULT_TONE_HZ = 600;

/**
 * bytesToBase64
 * -------------
 * Small utility: take a Uint8Array and return a base64 string.
 * Used to persist our generated WAV buffer to disk so expo-av can load it.
 */
function bytesToBase64(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i] ?? 0;
    const b2 = bytes[i + 1];
    const b3 = bytes[i + 2];
    const e1 = b1 >> 2;
    const e2 = ((b1 & 3) << 4) | ((b2 ?? 0) >> 4);
    const e3 = b2 !== undefined ? (((b2 & 15) << 2) | ((b3 ?? 0) >> 6)) : 64;
    const e4 = b3 !== undefined ? (b3 & 63) : 64;
    out +=
      chars.charAt(e1) +
      chars.charAt(e2) +
      chars.charAt(e3) +
      chars.charAt(e4);
  }
  return out;
}

/**
 * generateLoopingSineWav
 * ----------------------
 * Programmatically builds a mono 16-bit PCM WAV buffer that:
 *  - Contains an integer number of sine periods (so loop start == loop end phase),
 *  - Applies a small fade-in ramp only (prevents the initial click),
 *  - Is long (many cycles) so we rarely hit the loop boundary during press.
 *
 * This gives us a smooth continuous sidetone without loop "clicks" or "ticks".
 */
function generateLoopingSineWav(
  frequency: number,
  opts?: { sampleRate?: number; cycles?: number; amplitude?: number },
): Uint8Array {
  const sampleRate = opts?.sampleRate ?? 44100;
  const amplitude = Math.max(0, Math.min(1, opts?.amplitude ?? 0.28));

  // Quantize to whole samples per period to ensure seamless looping.
  const periodSamples = Math.max(1, Math.round(sampleRate / frequency));
  const cycles = opts?.cycles ?? 2000; // very long buffer to reduce loop resets
  const totalSamples = periodSamples * cycles;

  // Standard WAV header (PCM, mono, 16-bit)
  const bytesPerSample = 2;
  const dataSize = totalSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
  };

  // RIFF/WAVE header
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);   // PCM format
  view.setUint16(22, 1, true);   // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);  // 16-bit
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Write samples with a brief fade-in to avoid initial click.
  let offset = 44;
  const rampIn = Math.min(128, Math.floor(totalSamples * 0.002)); // ~3ms at 44.1kHz
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

/**
 * useKeyerOutputs
 * ---------------
 * Centralizes the "side effects" tied to the keyer button lifecycle:
 *  - Audio sidetone (expo-av) with seamless looping,
 *  - Haptics (expo-haptics / Vibration),
 *  - Fullscreen flash overlay (Animated.Value).
 *
 * What it does NOT do:
 *  - Torch control (camera LED),
 *  - Morse classification/timing rules.
 * Those live elsewhere so this hook stays focused on outputs only.
 */
export function useKeyerOutputs(options: UseKeyerOutputsOptions): UseKeyerOutputsResult {
  const { audioEnabled, hapticsEnabled, lightEnabled, torchEnabled, toneHz } = options;
  const torchSupported = isTorchAvailable();
  const torchPressRef = React.useRef(false);

  // Resolve an acceptable tone Hz (guarding against undefined/NaN/bad inputs)
  const resolveToneHz = React.useCallback(() => {
    const parsed = Number(toneHz);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TONE_HZ;
  }, [toneHz]);

  // 0..1 opacity used by the FlashOverlay component
  const flashOpacity = React.useRef(new Animated.Value(0)).current;

  // expo-av sound handle + the last prepared frequency
  const soundRef = React.useRef<Audio.Sound | null>(null);
  const currentToneRef = React.useRef<number | null>(null);

  // iOS can't do continuous vibrationâ€”simulate with periodic impacts
  const hapticIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * ensureAudioMode
   * ---------------
   * Configure expo-av so the sidetone:
   *  - Plays in iOS Silent Mode,
   *  - Ducks other audio on Android,
   *  - Doesn't try to route through the earpiece, etc.
   */
  const ensureAudioMode = React.useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });
    } catch {
      /* non-fatal */
    }
  }, []);

  /**
   * prepareTone(hz)
   * ---------------
   * Build and load a loop-perfect WAV file for the requested frequency,
   * cache it to disk, then create an expo-av Sound configured for looping.
   * Reuses the existing loaded sound if the frequency hasn't changed.
   */
  const prepareTone = React.useCallback(
    async (hz: number) => {
      // Reuse cached sound if the frequency is the same
      if (currentToneRef.current === hz && soundRef.current) return;

      // Otherwise unload the previous sound (if any)
      try {
        await soundRef.current?.unloadAsync();
      } catch {
        /* ignore */
      }
      soundRef.current = null;
      currentToneRef.current = null;

      await ensureAudioMode();

      // Generate and persist the WAV buffer to a cache file
      const wav = generateLoopingSineWav(hz, { cycles: 2000, amplitude: 0.28 });
      const base64 = bytesToBase64(wav);
      const dir = FileSystem.cacheDirectory + "morse-keyer/";
      try {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true } as any);
      } catch {
        /* ignore */
      }
      const uri = `${dir}keyer_${hz}.wav`;
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: "base64" as any });

      // Load as an expo-av sound and set to loop
      const created = await Audio.Sound.createAsync({ uri });
      soundRef.current = created.sound;
      currentToneRef.current = hz;
      try {
        await soundRef.current.setIsLoopingAsync(true);
      } catch {
        /* ignore */
      }
    },
    [ensureAudioMode],
  );

  /**
   * flashOn / flashOff
   * ------------------
   * Instant-on overlay for press-in, then a short fade-out on release.
   * This Animated.Value is consumed by <FlashOverlay /> at the screen level.
   */
  const flashOn = React.useCallback(() => {
    if (!lightEnabled) return;
    try {
      flashOpacity.stopAnimation(); // stop any in-flight fade
    } catch {
      /* ignore */
    }
    Animated.timing(flashOpacity, {
      toValue: 1,
      duration: 0,             // immediate snap to visible
      useNativeDriver: true,
    }).start();
  }, [lightEnabled, flashOpacity]);

  const flashOff = React.useCallback(() => {
    Animated.timing(flashOpacity, {
      toValue: 0,
      duration: 140,           // gentle fade-out feels better than snap
      useNativeDriver: true,
    }).start();
  }, [flashOpacity]);

  /**
   * Haptics
   * -------
   * Android: long vibration (system handles it).
   * iOS: periodic light impacts to mimic a "continuous" feel.
   */
  const startHaptics = React.useCallback(() => {
    if (!hapticsEnabled) return;

    if (Platform.OS === "android") {
      try {
        Vibration.vibrate(120000); // long buzz; we cancel on release
      } catch {
        /* ignore */
      }
      return;
    }

    // iOS kickstart impact
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      /* ignore */
    }

    // then continue with a light periodic tap to simulate continuity
    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = null;
    }
    hapticIntervalRef.current = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, 80);
  }, [hapticsEnabled]);

  const stopHaptics = React.useCallback(() => {
    if (Platform.OS === "android") {
      try {
        Vibration.cancel();
      } catch {
        /* ignore */
      }
      return;
    }

    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = null;
    }
  }, []);

  /**
   * startTone / stopTone
   * --------------------
   * Starts the sidetone at the chosen frequency (if enabled),
   * and seeks to position 0 before each play to avoid drift.
   */
  const startTone = React.useCallback(async () => {
    if (!audioEnabled) return;
    const hz = resolveToneHz();
    await prepareTone(hz);
    try {
      await soundRef.current?.setPositionAsync(0); // start at loop seam
      soundRef.current?.playAsync().catch(() => {});
    } catch {
      /* ignore */
    }
  }, [audioEnabled, prepareTone, resolveToneHz]);

  const stopTone = React.useCallback(async () => {
    try {
      await soundRef.current?.stopAsync();
      await soundRef.current?.setPositionAsync(0);
    } catch {
      /* ignore */
    }
  }, []);

  /**
   * prepare / teardown
   * ------------------
   * prepare(): optional warm-up so the first press has zero latency.
   * teardown(): full cleanup for unmount/navigation away.
   */
  const prepare = React.useCallback(async () => {
    if (!audioEnabled) return;
    const hz = resolveToneHz();
    await prepareTone(hz);
  }, [audioEnabled, prepareTone, resolveToneHz]);

  const teardown = React.useCallback(async () => {
    // Stop iOS tap loop if running
    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = null;
    }
    // Ensure Android vibration is canceled
    try {
      Vibration.cancel();
    } catch {
      /* ignore */
    }

    // Stop and unload sound if present
    try {
      await soundRef.current?.stopAsync();
    } catch {
      /* ignore */
    }
    try {
      await soundRef.current?.unloadAsync();
    } catch {
      /* ignore */
    }
    soundRef.current = null;
    currentToneRef.current = null;

    // Reset overlay
    flashOpacity.setValue(0);

    torchPressRef.current = false;
    await resetTorch();
  }, [flashOpacity]);

  /**
   * Public press handlers
   * ---------------------
   * Wire these directly to your KeyerButton onPressIn/onPressOut.
   * They do NOT do any timing/classificationâ€”only side effects.
   */
  const onDown = React.useCallback(() => {
    flashOn();
    startHaptics();
    if (torchSupported && torchEnabled) {
      torchPressRef.current = true;
      acquireTorch().catch(() => {});
    }
    startTone().catch(() => {});
  }, [flashOn, startHaptics, startTone, torchEnabled, torchSupported]);

  const onUp = React.useCallback(() => {
    flashOff();
    stopHaptics();
    if (torchPressRef.current) {
      torchPressRef.current = false;
      releaseTorch().catch(() => {});
    }
    stopTone().catch(() => {});
  }, [flashOff, stopHaptics, stopTone]);

  React.useEffect(() => {
    if (!torchSupported) return;
    if (!torchEnabled && torchPressRef.current) {
      torchPressRef.current = false;
      resetTorch().catch(() => {});
    }
  }, [torchEnabled, torchSupported]);

  // Safety: auto-clean if the component using this hook unmounts.
  React.useEffect(() => {
    return () => {
      teardown().catch(() => {});
    };
  }, [teardown]);

  return {
    onDown,
    onUp,
    flashOpacity,
    prepare,
    teardown,
  };
}

