// app/constants/theme.ts
// Design tokens for coin visuals and progress bar icons.

export const palette = {
  bg: '#000000',
  cyan: '#19E0D6',
  blue: '#1F6DFF',
  blueGlow: '#3AA8FF',
  green: '#18C56E',
  purple: '#8B5CF6',
  grayCoin: '#2A2E35',
  grayMuted: '#666A70',
  silver: '#BFC7D1',
  gold: '#FFB81C',
  white: '#FFFFFF',
} as const;

export const coinShadow = {
  glow: 'rgba(58,168,255,0.45)',
  green: 'rgba(24,197,110,0.45)',
  purple: 'rgba(139,92,246,0.45)',
  silver: 'rgba(191,199,209,0.45)',
  gold: 'rgba(255,184,28,0.45)',
} as const;

export const theme = {
  bg: { app: '#0B0B0F', card: '#111218' },
  text: { primary: '#FFFFFF', secondary: '#B8C1CC' },
  blue: { ring: '#00B3FF' }, // active
  green: { fill: '#22C55E', outline: '#166534' }, // receive complete
  gold: { fill: '#F5C542', outline: '#B8860B', icon: '#8B6B00' }, // send complete
  line: '#00A3C4',
  glow: 'rgba(0,179,255,0.35)',
};
export type LessonStatus =
  | 'locked'
  | 'active'
  | 'receiveComplete'
  | 'sendComplete';
export interface LessonMeta {
  id: string;
  title: string;
  subtitle: string;
  status: LessonStatus;
}
