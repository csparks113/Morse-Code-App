import { Audio } from 'expo-av';
import { useSettingsStore } from '../store/settingsStore';
import { charToMorse, textToMorse } from './morse';

// Static requires must be literal paths
const DOT = require('../assets/tones/dot.wav');
const DASH = require('../assets/tones/dash.wav');

async function playClip(res: number) {
  const { sound } = await Audio.Sound.createAsync(res, { volume: 1.0 });
  await sound.playAsync();
  const status = await sound.getStatusAsync();
  const duration = (status as any).durationMillis ?? 120;
  await new Promise((r) => setTimeout(r, duration + 20));
  await sound.unloadAsync();
}

function getUnitMs() {
  const wpm = useSettingsStore.getState().wpm; // approximate: 1200ms / WPM (PARIS standard)
  const unit = Math.max(30, Math.floor(1200 / wpm));
  return unit;
}

export async function playMorseForPattern(pattern: string) {
  const unit = getUnitMs();
  for (const symbol of pattern) {
    if (symbol === '·') {
      await playClip(DOT);
    } else if (symbol === '–') {
      await playClip(DASH);
    }
    await new Promise((r) => setTimeout(r, unit)); // intra-char gap handled by clip lengths + small gap
  }
}

export async function playMorseForChar(ch: string) {
  const pattern = charToMorse(ch);
  await playMorseForPattern(pattern);
}

export async function playMorseForText(text: string) {
  const unit = getUnitMs();
  const morse = textToMorse(text);
  const words = morse.split('/');
  for (let w = 0; w < words.length; w++) {
    const letters = words[w].trim().split(' ').filter(Boolean);
    for (let i = 0; i < letters.length; i++) {
      const p = letters[i];
      await playMorseForPattern(p);
      if (i < letters.length - 1)
        await new Promise((r) => setTimeout(r, unit * 3)); // letter gap
    }
    if (w < words.length - 1) await new Promise((r) => setTimeout(r, unit * 7)); // word gap
  }
}
