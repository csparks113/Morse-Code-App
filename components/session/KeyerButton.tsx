import React from "react";
import { Pressable, StyleSheet, StyleProp, Text, ViewStyle } from "react-native";

import { colors, spacing } from "@/theme/lessonTheme";

type KeyerButtonProps = {
  onPressIn?: () => void;
  onPressOut?: () => void;
  disabled?: boolean;
  minHeight?: number;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

const DEFAULT_LABEL = "Tap & Hold to Key";

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
      onPressIn={onPressIn}
      onPressOut={onPressOut}
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
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: "#0F151D",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing(3),
  },
  pressed: {
    backgroundColor: "#15202A",
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: 0.5,
  },
});

export default KeyerButton;
