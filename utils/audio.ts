// utils/audio.ts
// ---------------
// Audio helpers built on expo-av. We keep a cached pair of sounds for dot/dash.
// If the files aren't present yet, functions gracefully resolve without playing.
//
// Installation (already in Expo projects):
//   expo install expo-av
//
// Usage:
//   await playMorseForText("ET")  // plays "." then "-"

import { Audio } from "expo-av";
import { toMorse } from "./morse";

let dot: Audio.Sound | null = null;
let dash: Audio.Sound | null = null;

async function ensureLoaded() {
  // Avoid reloading on every call
  if (dot && dash) return;

  try {
    const [d1, d2] = await Promise.all([
      Audio.Sound.createAsync(require("../assets/tones/dot.wav")),
      Audio.Sound.createAsync(require("../assets/tones/dash.wav")),
    ]);
    dot = d1.sound;
    dash = d2.sound;
  } catch (e) {
    // If files missing, we fail silently (no crash) and just skip playing.
    console.warn("Morse audio not available yet (add assets/tones/dot.wav & dash.wav).");
  }
}

export async function playMorseCode(code: string, unitGapMs = 120) {
  await ensureLoaded();
  if (!dot || !dash) return;

  // Morse timing: dot = 1 unit, dash = 3 units, intra-character gap = 1 unit.
  for (let i = 0; i < code.length; i++) {
    const symbol = code[i];
    const sound = symbol === "." ? dot : dash;
    if (!sound) continue;
    await sound.replayAsync(); // play from start
    // Wait between elements; a crude fixed delay works fine for MVP.
    await new Promise((r) => setTimeout(r, unitGapMs * (symbol === "." ? 1 : 3)));
    // Intra-character gap
    await new Promise((r) => setTimeout(r, unitGapMs));
  }
}

export async function playMorseForText(text: string) {
  // Text like "ET" -> "." and "-"
  for (const ch of text.split("")) {
    const code = toMorse(ch);
    if (!code) continue;
    await playMorseCode(code);
    // Gap between letters (3 units)
    await new Promise((r) => setTimeout(r, 360));
  }
}
