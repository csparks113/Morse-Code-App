// theme/tokens.ts
// Shared design tokens for Morse Code Master.
// Provides base palette, spacing helpers, typography scales, and semantic aliases
// consumed by both the shell (tabs/settings) and the neon lesson experiences.

export type SpacingFn = (step: number) => number;

export const createSpacing = (baseUnit: number): SpacingFn => (step: number) => baseUnit * step;

export const palette = {
  background: '#0D0D0D',
  surface: '#121212',
  surfaceRaised: '#101214',
  surfaceMuted: '#15171C',
  surfaceSunken: '#0F151D',
  surfaceKeyer: '#10161F',
  surfacePressed: '#15202A',
  surfaceDisabled: '#151C25',
  surfaceSlate: '#11161C',
  border: '#1E2430',
  borderStrong: '#2A2F36',
  borderSubtle: '#2A313C',
  borderMuted: '#2F3846',
  borderKey: '#1F2933',
  textPrimary: '#EAEAEA',
  textSecondary: '#B9C0C7',
  textMuted: '#9BA0A6',
  accentPrimary: '#00E5FF',
  accentNeon: '#00E6FF',
  accentDeepBlue: '#0A84FF',
  accentTeal: '#00FFE0',
  accentGold: '#FFD700',
  accentGoldFill: '#B8860B',
  accentGreen: '#50C878',
  accentPurple: '#8B5CF6',
  accentSilver: '#BFC7D1',
  accentGrayCoin: '#2A2E35',
  accentGrayMuted: '#666A70',
  accentError: '#FF6B6B',
  accentWarning: '#FF9F1C',
  accentSuccess: '#39FF14',
  accentDanger: '#FF3B30',
  mutedIcon: '#3E424B',
  iconDisabled: '#7C8897',
} as const;



export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace(/^#/, '');
  const clamped = Math.max(0, Math.min(1, alpha));
  const value = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
  return `#${normalized}${value}`;
}

export const spacing = {
  base: createSpacing(4),
  lesson: createSpacing(8),
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const lessonRadii = {
  xl: 20,
  full: 999,
} as const;

export const typographyScale = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  display: 30,
  hero: 48,
} as const;

export const typography = {
  label: typographyScale.sm,
  body: typographyScale.md,
  subtitle: typographyScale.lg,
  title: typographyScale.xl,
  display: typographyScale.display,
  hero: typographyScale.hero,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  bold: '700',
  extraBold: '800',
  black: '900',
} as const;

export const semanticColors = {
  text: {
    primary: palette.textPrimary,
    secondary: palette.textSecondary,
    muted: palette.textMuted,
  },
  surface: {
    base: palette.surface,
    raised: palette.surfaceRaised,
    muted: palette.surfaceMuted,
    sunken: palette.surfaceSunken,
    keyer: palette.surfaceKeyer,
    pressed: palette.surfacePressed,
    disabled: palette.surfaceDisabled,
    slate: palette.surfaceSlate,
  },
  border: {
    base: palette.border,
    strong: palette.borderStrong,
    subtle: palette.borderSubtle,
    muted: palette.borderMuted,
    key: palette.borderKey,
  },
  accent: {
    primary: palette.accentPrimary,
    neon: palette.accentNeon,
    deep: palette.accentDeepBlue,
    teal: palette.accentTeal,
    gold: palette.accentGold,
    goldFill: palette.accentGoldFill,
    green: palette.accentGreen,
    purple: palette.accentPurple,
    silver: palette.accentSilver,
    grayCoin: palette.accentGrayCoin,
    grayMuted: palette.accentGrayMuted,
    success: palette.accentSuccess,
    warning: palette.accentWarning,
    error: palette.accentError,
    danger: palette.accentDanger,
  },
  icon: {
    muted: palette.mutedIcon,
    disabled: palette.iconDisabled,
  },
} as const;

