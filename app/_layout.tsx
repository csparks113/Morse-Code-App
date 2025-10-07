import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { I18nextProvider } from 'react-i18next';

import i18n, { initI18n } from '../i18n';
import { theme } from '../theme/theme';
import { configureAudio } from '../utils/audio';

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.colors.background,
    card: theme.colors.surface,
    border: theme.colors.border,
    text: theme.colors.textPrimary,
    primary: theme.colors.accent,
  },
};

export default function RootLayout() {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    console.log('[RootLayout] configureAudio start');

    (async () => {
      try {
        await configureAudio();
        if (!cancelled) {
          console.log('[RootLayout] configureAudio success', {
            elapsedMs: Date.now() - started,
          });
        }
      } catch (error) {
        console.error('[RootLayout] configureAudio failed', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    console.log('[RootLayout] initI18n start');

    (async () => {
      try {
        await initI18n();
        if (!cancelled) {
          console.log('[RootLayout] initI18n success', {
            elapsedMs: Date.now() - started,
          });
        }
      } catch (error) {
        console.error('[RootLayout] initI18n failed', error);
      } finally {
        if (!cancelled) {
          setReady(true);
        } else {
          console.log('[RootLayout] initI18n aborted');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="light" backgroundColor={theme.colors.background} />
          <View
            style={{
              flex: 1,
              backgroundColor: theme.colors.background,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ActivityIndicator color={theme.colors.accent} />
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nextProvider i18n={i18n}>
          <ThemeProvider value={navTheme}>
            <StatusBar style="light" backgroundColor={theme.colors.background} />
            <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: 'transparent' },
                  animation: 'fade',
                }}
              />
            </View>
          </ThemeProvider>
        </I18nextProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
