// app/(tabs)/practice.tsx
// -----------------------
// Minimal practice screen as requested. Later we can add free play or speed drills.

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "../../constants/theme";

export default function PracticeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Practice</Text>
      <Text style={styles.subtitle}>Free practice and drills coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(4) },
  title: { color: theme.colors.textPrimary, fontSize: theme.typography.title, fontWeight: "800" },
  subtitle: { color: theme.colors.muted, marginTop: theme.spacing(2) },
});