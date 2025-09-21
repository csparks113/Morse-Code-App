import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const baseHeight = 46; // desired bar height without insets
  const barHeight = baseHeight + insets.bottom;
  const padBottom = Math.max(0, insets.bottom);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        // Ensure the whole scene matches the app background (prevents white flash)
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: '#2A2F36',
          borderTopWidth: 1,
          height: barHeight,
          paddingBottom: padBottom,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textSecondary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" color={color} size={size + 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flash-outline" color={color} size={size + 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size + 4} />
          ),
        }}
      />
    </Tabs>
  );
}


