import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../theme/theme';

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.colors.background, // navigator background
    card: theme.colors.surface,          // headers/cards
    border: theme.colors.border,
    text: theme.colors.textPrimary,
    primary: theme.colors.accent,
  },
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        {/* Light status bar icons over dark background */}
        <StatusBar style="light" backgroundColor={theme.colors.background} />

        {/* Root wrapper ensures there's never a white frame behind the navigator */}
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <Stack
            screenOptions={{
              headerShown: false,
              // Let the Navigation theme show through; don't paint white
              contentStyle: { backgroundColor: 'transparent' },
              // Smooth fade helps hide any 1-frame seams on transitions
              animation: 'fade',
            }}
          />
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
