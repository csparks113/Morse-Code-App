// utils/morse.ts
// ---------------
// Minimal Morse code maps and helpers.
// - toMorse("E") -> "."
// - fromMorse(".") -> "E"
// - play strings like "ET" by splitting into chars and fetching their morse pattern.

const CHAR_TO_MORSE: Record<string, string> = {
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  '1': '.----',
  '2': '..---',
  '3': '...--',
  '4': '....-',
  '5': '.....',
  '6': '-....',
  '7': '--...',
  '8': '---..',
  '9': '----.',
  '0': '-----',
};

const MORSE_TO_CHAR = Object.fromEntries(
  Object.entries(CHAR_TO_MORSE).map(([ch, code]) => [code, ch]),
);

export function toMorse(input: string): string | undefined {
  return CHAR_TO_MORSE[input.toUpperCase()];
}

export function fromMorse(code: string): string | undefined {
  return MORSE_TO_CHAR[code];
}

// Split a "word" (set of letters) into an array of morse codes
export function wordToMorse(word: string): string[] {
  return word.split('').map((c) => toMorse(c) ?? '');
}
