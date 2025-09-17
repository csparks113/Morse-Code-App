// theme/lessonTheme.ts
// Neon dark theme tokens for the Lessons path UI

export const colors = {
  bg: '#0D0D0D',
  text: '#EAEAEA',
  textDim: '#9BA0A6',
  card: '#121212',

  // Path + neon accents
  // Use blueNeon for "active" and blueDeep for "available"
  blueDeep: '#0A84FF',  // AVAILABLE / unlocked but idle
  blueNeon: '#00E6FF',  // ACTIVE / pulsing
  // Back-compat alias (previously "AVAILABLE"):
  blue: '#0A84FF',

  neonTeal: '#00FFE0',  // keep for teal accents elsewhere if needed
  green: '#50C878',     // RECEIVE_DONE
  gold: '#FFD700',      // MASTERED / crown / star

  // These use the new neon blue as the base
  line: 'rgba(0,230,255,0.35)',   // dotted path
  border: 'rgba(0,230,255,0.55)', // neon outline for cards/nodes
} as const;

export const glow = {
  medium: {
    shadowColor: colors.blueNeon,
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 10,
  },
  neon: {
    shadowColor: colors.blueNeon,
    shadowOpacity: 0.9,
    shadowRadius: 18,
    elevation: 14,
  },
} as const;

export const radii = { xl: 20, full: 999 } as const;
export const spacing = (n: number) => n * 8;
export const thresholds = { receive: 80, send: 80 } as const;

// Coin visuals palette for lesson/challenge nodes and small summary coins.
export const coinPalette = {
  blueDeep: colors.blueDeep,
  blueNeon: colors.blueNeon,
  // Back-compat:
  blue: colors.blue,
  green: colors.green,
  gold: colors.gold,
  purple: '#8B5CF6',
  silver: '#BFC7D1',
  grayCoin: '#2A2E35',
  grayMuted: '#666A70',
  white: '#FFFFFF',
} as const;
