import React from "react";
import { Pressable, StyleSheet, StyleProp, Text, ViewStyle } from "react-native";

import { colors, spacing, surfaces, sessionControlTheme } from "@/theme/lessonTheme";

type KeyerButtonProps = {
  onPressIn?: (timestampMs?: number) => void;
  onPressOut?: (timestampMs?: number) => void;
  disabled?: boolean;
  minHeight?: number;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

const DEFAULT_LABEL = "Tap & Hold to Key";
const keyerButtonTheme = sessionControlTheme.keyerButton;
function KeyerButton({
  onPressIn,
  onPressOut,
  disabled = false,
  minHeight,
  label = DEFAULT_LABEL,
  style,
}: KeyerButtonProps) {
  return (
    <Pressable
      onPressIn={(event) => {
        onPressIn?.(event?.nativeEvent?.timestamp);
      }}
      onPressOut={(event) => {
        onPressOut?.(event?.nativeEvent?.timestamp);
      }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        minHeight != null ? { minHeight } : null,
        style,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%",
    borderRadius: keyerButtonTheme.borderRadius,
    borderWidth: keyerButtonTheme.borderWidth,
    borderColor: colors.border,
    backgroundColor: surfaces.sunken,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing(keyerButtonTheme.paddingVerticalStep),
  },
  pressed: {
    backgroundColor: surfaces.pressed,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: colors.text,
    fontWeight: "800",
    fontSize: keyerButtonTheme.fontSize,
    letterSpacing: keyerButtonTheme.letterSpacing,
  },
});

export default KeyerButton;





