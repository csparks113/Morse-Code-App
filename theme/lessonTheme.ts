// theme/lessonTheme.ts
// Neon dark theme tokens for the Lessons path UI

import { palette, spacing as spacingTokens, lessonRadii, withAlpha, fontWeight, typography } from './tokens';

type RevealBarSizeKey = 'sm' | 'md' | 'lg';
type RevealBarSizeTokens = {
  glyphSize: number;
  glyphGapStep: number;
  timelineHeight: number;
  compareUnitPx: number;
};
type RevealBarTheme = {
  slotPaddingStep: number;
  compareRowGapStep: number;
  sizes: Record<RevealBarSizeKey, RevealBarSizeTokens>;
  legend: {
    dotSize: number;
    dotRadius: number;
    dotMarginStep: number;
    marginBottomStep: number;
    spacerStep: number;
    labelFontSize: number;
    labelFontWeight: (typeof fontWeight)[keyof typeof fontWeight];
  };
  glyphs: { defaultDashRatio: number };
  timeline: { defaultCompareWpm: number };
};

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


export const promptCardTheme = {
  container: {
    minWidth: 225,
    maxWidth: 560,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  main: {
    minHeight: 110,
  },
  reveal: {
    minHeight: 60,
  },
  label: {
    fontSize: 15,
    letterSpacing: 0.6,
  },
  char: {
    fontSize: 104,
    lineHeight: 104,
    fontWeight: fontWeight.black,
  },
  startButton: {
    minWidth: 150,
    paddingVerticalStep: 2.25,
    paddingHorizontalStep: 5.5,
    borderRadius: 32,
    fontSize: 18,
    fontWeight: fontWeight.extraBold,
  },
} as const;
export const revealBarTheme = {
  slotPaddingStep: 3,
  compareRowGapStep: 0.75,
  sizes: {
    sm: {
      glyphSize: 10,
      glyphGapStep: 0.75,
      timelineHeight: 10,
      compareUnitPx: 9,
    },
    md: {
      glyphSize: 12,
      glyphGapStep: 1,
      timelineHeight: 12,
      compareUnitPx: 12,
    },
    lg: {
      glyphSize: 14,
      glyphGapStep: 1.25,
      timelineHeight: 14,
      compareUnitPx: 14,
    },
  },
  legend: {
    dotSize: 10,
    dotRadius: 5,
    dotMarginStep: 0.75,
    marginBottomStep: 0.5,
    spacerStep: 1.5,
    labelFontSize: typography.label,
    labelFontWeight: fontWeight.medium,
  },
  glyphs: {
    defaultDashRatio: 3,
  },
  timeline: {
    defaultCompareWpm: 12,
  },
} as const satisfies RevealBarTheme;

export const sessionLayoutTheme = {
  container: {
    paddingHorizontalStep: 3,
  },
  groups: {
    verticalGapStep: 0.5,
  },
  toggles: {
    minHeight: 64,
  },
  inputZone: {
    minHeight: 140,
  },
  summary: {
    paddingHorizontalStep: 3,
    paddingTopStep: 2,
    paddingBottomStep: 2,
  },
  emptyState: {
    gapStep: 4,
    paddingStep: 4,
  },
  footer: {
    topPaddingStep: 2,
    paddingStep: {
      standard: 2,
      summary: 4,
      dev: 2,
      practice: 2,
    },
  },
} as const;





export const sessionControlTheme = {
  actionButton: {
    size: 58,
    borderRadius: 20,
    borderWidth: 2,
    iconSize: 28,
    shadowRadius: 12,
  },
  outputToggle: {
    size: 48,
    borderRadius: 16,
    borderWidth: 2,
    iconSize: 22,
    activeShadowRadius: 9,
  },
  keyerButton: {
    borderRadius: 18,
    borderWidth: 2,
    paddingVerticalStep: 3,
    fontSize: 18,
    letterSpacing: 0.5,
  },
  challengeKeyboard: {
    rowGapStep: 0.6,
    key: {
      width: 32,
      height: 40,
      borderRadius: 14,
      borderWidth: 2,
      fontSize: 16,
      letterSpacing: 0.5,
    },
  },
  lessonChoice: {
    borderRadius: 18,
    borderWidth: 2,
    paddingVerticalStep: 3,
    fontSize: 32,
    letterSpacing: 4,
  },
} as const;

