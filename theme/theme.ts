// theme/theme.ts
// ------------------
// App-wide theme for non-lessons screens (tabs, receive/send screens, etc.).
// This is the "neon dark" app shell theme the rest of the UI references.
// Colors, spacing, and typography now reference shared tokens from tokens.ts.

import { palette, spacing, radii, typography, typographyScale } from './tokens';

export const theme = {
  colors: {
    background: palette.background,
    surface: palette.surface,
    textPrimary: palette.textPrimary,
    textSecondary: palette.textSecondary,
    muted: palette.textMuted,
    accent: palette.accentPrimary,
    border: palette.border,
    disabled: palette.borderStrong,
    success: palette.accentSuccess,
    error: palette.accentError,
  },
  spacing: spacing.base,
  radius: radii,
  typography: {
    title: typography.title,
    subtitle: typography.subtitle,
    body: typography.body,
    small: typography.label,
    tiny: typographyScale.xs,
  },
  shadow: {
    card: {
      // Cross-platform shadow (Android elevation + iOS shadow)
      elevation: 4,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    },
  },
} as const;
