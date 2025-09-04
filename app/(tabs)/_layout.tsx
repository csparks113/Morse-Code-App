// app/(tabs)/_layout.tsx
// ----------------------
// Defines the 3-tab layout using Expo Router's <Tabs />. The "index" route
// (Lessons) is the HOME tab.

import React from "react";
import { Tabs } from "expo-router";
import { theme } from "../../constants/theme";
import { Text } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTitleStyle: { color: theme.colors.textPrimary },
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
        tabBarActiveTintColor: theme.colors.textSecondary,
        tabBarInactiveTintColor: theme.colors.muted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarLabel: "Home",
          tabBarIcon: ({ color }) => <Text style={{ color }}>●</Text>,
          headerTitle: "Lessons",
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: "Practice",
          tabBarLabel: "Practice",
          tabBarIcon: ({ color }) => <Text style={{ color }}>▲</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarLabel: "Settings",
          tabBarIcon: ({ color }) => <Text style={{ color }}>⚙︎</Text>,
        }}
      />
    </Tabs>
  );
}
