import { Level } from '../types';

export const levels: Level[] = [
  { id: 'l1', title: 'Level 1: E & T', chars: ['E', 'T'] },
  { id: 'l2', title: 'Level 2: A & N', chars: ['A', 'N'] },
  { id: 'l3', title: 'Level 3: I & M', chars: ['I', 'M'] },
  { id: 'l4', title: 'Level 4: S & O', chars: ['S', 'O'] },
  { id: 'l5', title: 'Level 5: H & K', chars: ['H', 'K'] },
  { id: 'l6', title: 'Level 6: U & R', chars: ['U', 'R'] },
  { id: 'l7', title: 'Level 7: D & W', chars: ['D', 'W'] },
  { id: 'l8', title: 'Level 8: L & G', chars: ['L', 'G'] },
  { id: 'l9', title: 'Level 9: P & Q', chars: ['P', 'Q'] },
  { id: 'l10', title: 'Level 10: Y & Z', chars: ['Y', 'Z'] },
  { id: 'l11', title: 'Digits: 0–5', chars: ['0', '1', '2', '3', '4', '5'] },
  { id: 'l12', title: 'Digits: 6–9', chars: ['6', '7', '8', '9'] },
];

export function getLevelById(id?: string) {
  const level = levels.find((l) => l.id === id);
  if (!level) throw new Error(`Level not found: ${id}`);
  return level;
}
