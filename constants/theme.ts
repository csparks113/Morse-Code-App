// constants/theme.ts
// ------------------
// Centralized Warm Luxe theme tokens so all screens/components can stay consistent.
// Using simple JS objects (no theming lib required). If you later adopt NativeWind
// or a UI kit, you can map these tokens into that system.

export const theme = {
  colors: {
    // Warm Luxe palette we agreed on:
    background: '#121212', // Obsidian Black
    surface: '#1A1A1A', // Slightly lighter than background for cards
    textPrimary: '#FAF3E0', // Champagne White
    textSecondary: '#E5C07B', // Desert Sand (also used for progress fill)
    accent: '#B8860B', // Rich Bronze (for active states/buttons)
    border: '#2A2A2A', // Subtle borders/dividers
    muted: '#9E8F6B', // Muted bronze/sand for secondary UI
    disabled: '#3A3A3A',
    success: '#7FB77E',
    error: '#C85C5C',
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
      // Cross-platform shadow look (Android elevation + iOS shadow)
      elevation: 4,
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
  },
} as const;
