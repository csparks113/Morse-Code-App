import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../theme/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/* Light icons for battery / Wi-Fi / signal */}
      <StatusBar style="light" translucent backgroundColor="transparent" />

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      />
    </SafeAreaProvider>
  );
}
