// constants/theme.ts
// ------------------
// App-wide theme for non-lessons screens (tabs, receive/send screens, etc.).
// This is the "neon dark" app shell theme the rest of the UI references.
// - background: deep black
// - textPrimary: white text for high contrast
// - textSecondary/muted: greys used for secondary labels
// - accent: neon blue used for emphasis (active tab, buttons)
// We intentionally keep this small and framework-agnostic.

export const theme = {
  colors: {
    background: '#0D0D0D', // black background
    surface: '#121212', // slightly lighter for cards/surfaces
    textPrimary: '#EAEAEA', // primary text (white)
    textSecondary: '#B9C0C7', // secondary text (light grey)
    muted: '#9BA0A6', // tertiary labels
    accent: '#00E5FF', // neon blue accent
    border: '#1E2430', // subtle teal-blue divider
    disabled: '#2A2F36',
    success: '#39FF14', // for quick affordances
    error: '#FF6B6B',
  },
  spacing: (n: number) => 4 * n, // 4dp grid. spacing(4) = 16
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    pill: 999,
  },
  typography: {
    title: 24,
    subtitle: 18,
    body: 16,
    small: 14,
    tiny: 12,
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
