// components/FixedControlsLayout.tsx
import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";

type Props = {
  /** Main card / prompt area */
  children: React.ReactNode;
  /** The 4 output toggles row (haptics / flash / audio / screen) */
  toggles: React.ReactNode;
  /** Bottom input area (keyer button OR keyboard) */
  bottomInput: React.ReactNode;
  style?: ViewStyle;
};

export default function FixedControlsLayout({ children, toggles, bottomInput, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.promptArea}>{children}</View>

      {/* Fixed height so the toggles always live in the same y-position across screens */}
      <View style={styles.togglesArea}>{toggles}</View>

      {/* Bottom input gets its own fixed area */}
      <View style={styles.bottomArea}>{bottomInput}</View>
    </View>
  );
}

const TOGGLES_HEIGHT = 72;   // identical everywhere
const BOTTOM_HEIGHT  = 104;  // keyboard keyer/btn area; adjust if needed

const styles = StyleSheet.create({
  container: { flex: 1 },
  promptArea: { flex: 1, justifyContent: "center", paddingHorizontal: 20 },
  togglesArea: {
    height: TOGGLES_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  bottomArea: {
    height: BOTTOM_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 12, // breathing room from the bottom tabs
  },
});
