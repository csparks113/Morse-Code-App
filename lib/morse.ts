export const MORSE: Record<string, string> = {
  A: '·–',
  B: '–···',
  C: '–·–·',
  D: '–··',
  E: '·',
  F: '··–·',
  G: '––·',
  H: '····',
  I: '··',
  J: '·–––',
  K: '–·–',
  L: '·–··',
  M: '––',
  N: '–·',
  O: '–––',
  P: '·––·',
  Q: '––·–',
  R: '·–·',
  S: '···',
  T: '–',
  U: '··–',
  V: '···–',
  W: '·––',
  X: '–··–',
  Y: '–·––',
  Z: '––··',
  0: '–––––',
  1: '·––––',
  2: '··–––',
  3: '···––',
  4: '····–',
  5: '·····',
  6: '–····',
  7: '––···',
  8: '–––··',
  9: '––––·',
};

const REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(MORSE).map(([k, v]) => [v, k]),
);

export function charToMorse(ch: string): string {
  const up = ch.toUpperCase();
  return MORSE[up] ?? '';
}

export function textToMorse(text: string): string {
  return text
    .toUpperCase()
    .split('')
    .map((c) => MORSE[c] ?? '/')
    .join(' ');
}

export function morseToText(morse: string): string {
  return morse
    .trim()
    .split(/\s+/)
    .map((pattern) => REVERSE[pattern] ?? '?')
    .join('');
}
