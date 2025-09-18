/**
 * ACTION BUTTON
 * -------------
 * OVERVIEW
 * A compact rounded square button used for small actions like
 * "Reveal" or "Play" in the session screens. Shows a single icon.
 *
 * PROPS
 * - icon: MaterialCommunityIcons name (string literal)
 * - onPress: click handler
 * - accessibilityLabel: label for screen readers
 * - disabled?: disables interactions + dims the button
 * - active?: highlights the button (e.g., reveal toggled on)
 * - style?: allow caller to override/extend layout styles
 *
 * ACCESSIBILITY
 * - accessibilityRole="button"
 * - accessibilityState reflects { disabled, selected: active }
 */

import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/theme/lessonTheme';

const SIZE = 58;

type Props = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  active?: boolean;
  style?: ViewStyle;
};

export default function ActionButton({
  icon,
  onPress,
  accessibilityLabel,
  disabled,
  active,
  style,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      // `pressed` lets us slightly fade the button while pressing
      style={({ pressed }) => [
        styles.base,
        active && styles.active,
        disabled && styles.disabled,
        pressed && !disabled && { opacity: 0.92 },
        style,
      ]}
    >
      {/* The icon color switches when `active` */}
      <MaterialCommunityIcons
        name={icon}
        size={28}
        color={active ? colors.blueNeon : colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: SIZE,
    height: SIZE,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#2A313C',
    backgroundColor: '#10161F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: {
    borderColor: colors.blueNeon,
    shadowColor: colors.blueNeon,
    shadowOpacity: 0.7,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  disabled: {
    opacity: 0.5,
  },
});
