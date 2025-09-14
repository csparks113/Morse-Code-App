// utils/audio.ts
import { Audio } from 'expo-av';
// Use legacy API to preserve current behavior on SDK 54
// (avoids runtime error thrown by new API wrapper)
import * as FileSystem from 'expo-file-system/legacy';
import { toMorse } from './morse';
import { useSettingsStore } from '../store/useSettingsStore';

let genDot: Audio.Sound | null = null;
let genDash: Audio.Sound | null = null;
let currentHz: number | null = null;
let currentUnit: number | null = null;

// Unit length (dot) in ms derived from WPM: dot = 1200 / WPM (PARIS standard).
// Exposed as a function so UI changes (settings) are reflected immediately.
export function getMorseUnitMs(): number {
  const { wpm } = useSettingsStore.getState() as any;
  const safeWpm = Math.max(5, Math.min(60, Number(wpm) || 20));
  return Math.round(1200 / safeWpm);
}

type PlayOpts = {
  // Called at the START of each symbol; gives symbol and its duration in ms (1u or 3u)
  onSymbolStart?: (symbol: '.' | '-', durationMs: number) => void;
};

// Simple base64 encoder for Uint8Array (no external deps)
function bytesToBase64(bytes: Uint8Array): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i] ?? 0;
    const b2 = bytes[i + 1];
    const b3 = bytes[i + 2];
    const enc1 = b1 >> 2;
    const enc2 = ((b1 & 3) << 4) | ((b2 ?? 0) >> 4);
    const enc3 = b2 === undefined ? 64 : ((b2 & 15) << 2) | ((b3 ?? 0) >> 6);
    const enc4 = b3 === undefined ? 64 : b3 & 63;
    output +=
      chars.charAt(enc1) +
      chars.charAt(enc2) +
      chars.charAt(enc3) +
      chars.charAt(enc4);
  }
  return output;
}

// Generate 16-bit PCM mono WAV bytes for a sine tone
function generateSineWavBytes(
  frequency: number,
  durationMs: number,
  sampleRate = 44100,
  amplitude = 0.3,
): Uint8Array {
  const numSamples = Math.max(1, Math.round((durationMs / 1000) * sampleRate));
  const bytesPerSample = 2; // 16-bit mono
  const dataSize = numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++)
      view.setUint8(offset + i, str.charCodeAt(i));
  };

  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM subchunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // Byte rate
  view.setUint16(32, bytesPerSample, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM samples
  let offset = 44;
  const amp = Math.max(0, Math.min(1, amplitude)) * 0.9;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * frequency * t);
    const s = Math.max(-1, Math.min(1, sample));
    const val = (s * amp * 32767) | 0;
    view.setInt16(offset, val, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

async function ensureGenerated(hz: number, unitMs: number) {
  if (genDot && genDash && currentHz === hz && currentUnit === unitMs) return;
  try {
    await genDot?.unloadAsync();
  } catch {}
  try {
    await genDash?.unloadAsync();
  } catch {}
  genDot = null;
  genDash = null;

  const dotBytes = generateSineWavBytes(hz, unitMs);
  const dashBytes = generateSineWavBytes(hz, unitMs * 3);
  const dotB64 = bytesToBase64(dotBytes);
  const dashB64 = bytesToBase64(dashBytes);
  const dir =
    (FileSystem as any).cacheDirectory ??
    (FileSystem as any).documentDirectory ??
    '';
  const dotUri = dir + `morse-dot-${hz}-${unitMs}.wav`;
  const dashUri = dir + `morse-dash-${hz}-${unitMs}.wav`;
  await FileSystem.writeAsStringAsync(dotUri, dotB64, {
    encoding: 'base64' as any,
  });
  await FileSystem.writeAsStringAsync(dashUri, dashB64, {
    encoding: 'base64' as any,
  });
  const [d1, d2] = await Promise.all([
    Audio.Sound.createAsync({ uri: dotUri }),
    Audio.Sound.createAsync({ uri: dashUri }),
  ]);
  genDot = d1.sound;
  genDash = d2.sound;
  currentHz = hz;
  currentUnit = unitMs;
}

export async function playMorseCode(
  code: string,
  unitGapMs = getMorseUnitMs(),
  opts?: PlayOpts,
) {
  const { audioEnabled, toneHz } = useSettingsStore.getState() as any;
  await ensureGenerated(Number(toneHz) || 600, unitGapMs);

  for (let i = 0; i < code.length; i++) {
    const symbol = code[i] as '.' | '-';
    const durationMs = unitGapMs * (symbol === '.' ? 1 : 3);

    // Notify screens to do visuals/haptics
    opts?.onSymbolStart?.(symbol, durationMs);

    // Play sound if enabled and loaded (no-op otherwise)
    if (audioEnabled && genDot && genDash) {
      const sound = symbol === '.' ? genDot : genDash;
      await sound?.replayAsync();
    }

    // Symbol length + intra-character gap (1 unit)
    await new Promise((r) => setTimeout(r, durationMs));
    await new Promise((r) => setTimeout(r, unitGapMs));
  }
}

export async function playMorseForText(
  text: string,
  unitGapMs = getMorseUnitMs(),
  opts?: PlayOpts,
) {
  for (const ch of text.split('')) {
    const code = toMorse(ch);
    if (!code) continue;
    await playMorseCode(code, unitGapMs, opts);
    // Inter-letter gap = ~3 units
    await new Promise((r) => setTimeout(r, unitGapMs * 3));
  }
}
