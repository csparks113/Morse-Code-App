// theme/lessonTheme.ts
// Neon dark theme tokens for the Lessons path UI

export const colors = {
  bg: '#0D0D0D',
  text: '#EAEAEA',
  textDim: '#9BA0A6',
  card: '#121212',

  // Path + neon accents
  line: 'rgba(0,255,224,0.35)', // dotted path
  neonTeal: '#00FFE0',
  blue: '#2F7DFF', // AVAILABLE
  green: '#50C878', // RECEIVE_DONE
  gold: '#FFD700', // MASTERED / crown / star
  border: 'rgba(0,255,224,0.55)', // neon outline for cards/nodes
} as const;

export const glow = {
  medium: {
    shadowColor: '#00FFE0',
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 10,
  },
} as const;

export const radii = { xl: 20, full: 999 } as const;
export const spacing = (n: number) => n * 8;
export const thresholds = { receive: 80, send: 80 } as const;
// Coin visuals palette for lesson/challenge nodes and small summary coins.
// Kept here to avoid a separate coinTheme file.
export const coinPalette = {
  blue: colors.blue,
  green: colors.green,
  gold: colors.gold,
  purple: '#8B5CF6',
  silver: '#BFC7D1',
  grayCoin: '#2A2E35',
  grayMuted: '#666A70',
  white: '#FFFFFF',
} as const;
