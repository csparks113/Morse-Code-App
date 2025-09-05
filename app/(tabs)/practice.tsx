// app/(tabs)/practice.tsx
// -----------------------
// Minimal practice screen as requested. Later we can add free play or speed drills.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PracticeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Practice</Text>
        <Text style={styles.subtitle}>
          Free practice and drills coming soon.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing(4),
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: '800',
  },
  subtitle: { color: theme.colors.muted, marginTop: theme.spacing(2) },
});
