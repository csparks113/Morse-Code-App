// components/ProgressBar.tsx
// --------------------------
// Tiny horizontal progress bar used in the header modal and elsewhere.

import React from "react";
import { View, StyleSheet } from "react-native";
import { theme } from "../constants/theme";

type Props = { value: number }; // 0..1

export default function ProgressBar({ value }: Props) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.max(0, Math.min(1, value)) * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    height: 10,
    backgroundColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: theme.colors.textSecondary, // Desert Sand
  },
});
