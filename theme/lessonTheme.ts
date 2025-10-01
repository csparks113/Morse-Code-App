// theme/lessonTheme.ts
// Neon dark theme tokens for the Lessons path UI

import { palette, spacing as spacingTokens, lessonRadii, withAlpha } from './tokens';

export const colors = {
  bg: palette.background,
  text: palette.textPrimary,
  textDim: palette.textMuted,
  card: palette.surfaceRaised,

  // Path + neon accents
  // Use blueNeon for "active" and blueDeep for "available"
  blueDeep: palette.accentDeepBlue,
  blueNeon: palette.accentNeon,
  // Back-compat alias (previously "AVAILABLE"):
  blue: palette.accentDeepBlue,

  neonTeal: palette.accentTeal,
  green: palette.accentGreen,
  gold: palette.accentGold,

  // These use the new neon blue as the base
  line: withAlpha(palette.accentNeon, 0.35), // dotted path
  border: withAlpha(palette.accentNeon, 0.55), // neon outline for cards/nodes
} as const;

export const gradients = {
  progressGold: [withAlpha(palette.accentGold, 0.65), palette.accentGold],
  summaryGold: [withAlpha(palette.accentGold, 0.75), palette.accentGold],
  summaryBlue: [withAlpha(palette.accentNeon, 0.7), palette.accentDeepBlue],
  headerProgress: ['#FFD700', '#FFC837', '#FFB347'],
} as const;

export const surfaces = {
  card: palette.surfaceRaised,
  muted: palette.surfaceMuted,
  sunken: palette.surfaceSunken,
  keyer: palette.surfaceKeyer,
  pressed: palette.surfacePressed,
  disabled: palette.surfaceDisabled,
  slate: palette.surfaceSlate,
} as const;

export const borders = {
  base: palette.borderStrong,
  subtle: palette.borderSubtle,
  muted: palette.borderMuted,
  key: palette.borderKey,
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

export const radii = lessonRadii;
export const spacing = spacingTokens.lesson;
export const thresholds = { receive: 80, send: 80 } as const;

// Coin visuals palette for lesson/challenge nodes and small summary coins.
export const coinPalette = {
  blueDeep: colors.blueDeep,
  blueNeon: colors.blueNeon,
  // Back-compat:
  blue: colors.blue,
  green: colors.green,
  gold: colors.gold,
  goldFill: palette.accentGoldFill,
  purple: palette.accentPurple,
  silver: palette.accentSilver,
  grayCoin: palette.accentGrayCoin,
  grayMuted: palette.accentGrayMuted,
  white: '#FFFFFF',
} as const;

export const icons = {
  muted: palette.mutedIcon,
  disabled: palette.iconDisabled,
} as const;

export const status = {
  error: palette.accentError,
  warning: palette.accentWarning,
  success: palette.accentSuccess,
} as const;

