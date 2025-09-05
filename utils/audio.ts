// utils/audio.ts
import { Audio } from 'expo-av';
import { toMorse } from './morse';
import { useSettingsStore } from '../store/useSettingsStore';

let dot: Audio.Sound | null = null;
let dash: Audio.Sound | null = null;

// Use a shared unit so screens can align visuals with audio
export const MORSE_UNIT_MS = 120;

type PlayOpts = {
  // Called at the START of each symbol; gives symbol and its duration in ms (1u or 3u)
  onSymbolStart?: (symbol: '.' | '-', durationMs: number) => void;
};

async function ensureLoaded() {
  if (dot && dash) return;
  try {
    const [d1, d2] = await Promise.all([
      Audio.Sound.createAsync(require('../assets/tones/dot.wav')),
      Audio.Sound.createAsync(require('../assets/tones/dash.wav')),
    ]);
    dot = d1.sound;
    dash = d2.sound;
  } catch {
    console.warn(
      'Morse audio not available yet (add assets/tones/dot.wav & dash.wav).',
    );
  }
}

export async function playMorseCode(
  code: string,
  unitGapMs = MORSE_UNIT_MS,
  opts?: PlayOpts,
) {
  const { audioEnabled } = useSettingsStore.getState();
  await ensureLoaded();

  for (let i = 0; i < code.length; i++) {
    const symbol = code[i] as '.' | '-';
    const durationMs = unitGapMs * (symbol === '.' ? 1 : 3);

    // 🔔 Notify screens to do visuals/haptics
    opts?.onSymbolStart?.(symbol, durationMs);

    // Play sound if enabled and loaded (no-op otherwise)
    if (audioEnabled && dot && dash) {
      const sound = symbol === '.' ? dot : dash;
      await sound?.replayAsync();
    }

    // Symbol length + intra-character gap (1 unit)
    await new Promise((r) => setTimeout(r, durationMs));
    await new Promise((r) => setTimeout(r, unitGapMs));
  }
}

export async function playMorseForText(
  text: string,
  unitGapMs = MORSE_UNIT_MS,
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
