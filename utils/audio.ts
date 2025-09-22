// utils/audio.ts
// Tight sync of audio + haptics + flash by triggering non-audio channels
// on the actual audio start edge (status.isPlaying / positionMillis>0), with a short fallback.

import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { toMorse } from './morse';
import { useSettingsStore } from '../store/useSettingsStore';

let genDot: Audio.Sound | null = null;
let genDash: Audio.Sound | null = null;
let currentHz: number | null = null;
let currentUnit: number | null = null;

export function getMorseUnitMs(): number {
  const { wpm } = useSettingsStore.getState() as any;
  const safeWpm = Math.max(5, Math.min(60, Number(wpm) || 12));
  return Math.round(1200 / safeWpm);
}

type PlayOpts = {
  /** Called when the symbol actually begins (or fallback fires). */
  onSymbolStart?: (symbol: '.' | '-', durationMs: number) => void;
};

/** Simple base64 encoder for Uint8Array (no external deps). */
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
    const enc3 = b2 !== undefined ? (((b2 & 15) << 2) | ((b3 ?? 0) >> 6)) : 64;
    const enc4 = b3 !== undefined ? (b3 & 63) : 64;
    output +=
      chars.charAt(enc1) +
      chars.charAt(enc2) +
      chars.charAt(enc3) +
      chars.charAt(enc4);
  }
  return output;
}

/** Generate a 16-bit mono PCM sine wave WAV bytes. */
function generateSineWavBytes(
  frequency: number,
  durationMs: number,
  sampleRate = 44100,
  amplitude = 0.3
): Uint8Array {
  const numSamples = Math.max(1, Math.round((durationMs / 1000) * sampleRate));
  const bytesPerSample = 2; // 16-bit mono
  const dataSize = numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  // WAV header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, 1, true);  // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM samples
  let offset = 44;
  const amp = Math.max(0, Math.min(1, amplitude)) * 0.9;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const s = Math.sin(2 * Math.PI * frequency * t);
    const val = (Math.max(-1, Math.min(1, s)) * amp * 32767) | 0;
    view.setInt16(offset, val, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

// ---------- Audio mode + generator ----------

let _audioModeSet = false;
async function ensureAudioMode() {
  if (_audioModeSet) return;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
      playThroughEarpieceAndroid: false,
    });
  } catch {
    // non-fatal
  }
  _audioModeSet = true;
}

export async function ensureGenerated(hz: number, unitMs: number) {
  await ensureAudioMode();

  if (genDot && genDash && currentHz === hz && currentUnit === unitMs) return;
  try { await genDot?.unloadAsync(); } catch {}
  try { await genDash?.unloadAsync(); } catch {}
  genDot = null; genDash = null;

  const dotBytes = generateSineWavBytes(hz, unitMs);
  const dashBytes = generateSineWavBytes(hz, unitMs * 3);
  const dotB64 = bytesToBase64(dotBytes);
  const dashB64 = bytesToBase64(dashBytes);

  const dir = FileSystem.cacheDirectory + 'morse-tones/';
  try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true } as any); } catch {}

  const dotUri  = dir + `dot_${hz}_${unitMs}.wav`;
  const dashUri = dir + `dash_${hz}_${unitMs}.wav`;

  await FileSystem.writeAsStringAsync(dotUri, dotB64, { encoding: 'base64' as any });
  await FileSystem.writeAsStringAsync(dashUri, dashB64, { encoding: 'base64' as any });

  const [d1, d2] = await Promise.all([
    Audio.Sound.createAsync({ uri: dotUri }),
    Audio.Sound.createAsync({ uri: dashUri }),
  ]);
  genDot = d1.sound;
  genDash = d2.sound;
  currentHz = hz;
  currentUnit = unitMs;
}

// ---------- Playback (aligned) ----------

export async function playMorseCode(
  code: string,
  unitGapMs = getMorseUnitMs(),
  opts?: PlayOpts
) {
  const { audioEnabled, toneHz } = useSettingsStore.getState() as any;
  await ensureGenerated(Number(toneHz) || 600, unitGapMs);

  // Wait until a specific sound actually starts (event or status poll), with a tight cap.
  async function waitForStart(sound: Audio.Sound, hardMaxMs = 260): Promise<void> {
    const t0 = Date.now();
    let resolved = false;

    return new Promise<void>((resolve) => {
      const resolveOnce = () => {
        if (!resolved) {
          resolved = true;
          try { sound.setOnPlaybackStatusUpdate(null); } catch {}
          resolve();
        }
      };

      // Event path
      try {
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (!('isLoaded' in status)) return;
          if (status.isPlaying) resolveOnce();
        });
      } catch {}

      // Kick + poll as safety
      (async () => {
        try { await sound.setPositionAsync(0); } catch {}
        try { sound.playAsync().catch(() => {}); } catch {}

        const poll = async () => {
          if (resolved) return;
          try {
            const st: any = await sound.getStatusAsync();
            if (st && 'isLoaded' in st && (st.isPlaying || (st.positionMillis ?? 0) > 0)) {
              resolveOnce();
              return;
            }
          } catch {}
          if (Date.now() - t0 >= hardMaxMs) {
            resolveOnce();
            return;
          }
          setTimeout(poll, 15); // ~one frame
        };
        poll();
      })();
    });
  }

  for (let i = 0; i < code.length; i++) {
    const symbol = code[i] as '.' | '-';
    if (symbol !== '.' && symbol !== '-') continue;

    const durationMs = unitGapMs * (symbol === '.' ? 1 : 3);

    let sound: Audio.Sound | null = null;
    if (audioEnabled && genDot && genDash) {
      sound = symbol === '.' ? genDot : genDash;
    }

    // Anchor to actual audio start
    if (sound) await waitForStart(sound);

    // Fire non-audio channels right on the start edge
    opts?.onSymbolStart?.(symbol, durationMs);

    // Hold symbol + 1u intra-character gap (except after last symbol)
    await new Promise((r) => setTimeout(r, durationMs));
    if (i < code.length - 1) {
      await new Promise((r) => setTimeout(r, unitGapMs));
    }
  }
}

/** Plays a string of letters/spaces with letter/word gaps. */
export async function playMorseString(
  str: string,
  unitGapMs = getMorseUnitMs(),
  opts?: PlayOpts
) {
  const chars = str.split('');
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === ' ') {
      await new Promise((r) => setTimeout(r, unitGapMs * 7)); // word gap
      continue;
    }
    const code = toMorse(ch);
    if (!code) continue;

    await playMorseCode(code, unitGapMs, opts);

    const next = chars[i + 1];
    if (next && next !== ' ') {
      await new Promise((r) => setTimeout(r, unitGapMs * 3)); // inter-character gap
    }
  }
}

