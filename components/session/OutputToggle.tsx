/**
 * OUTPUT TOGGLE
 * -------------
 * OVERVIEW
 * Small rounded-square toggle used for enabling/disabling outputs like:
 * - Haptics
 * - Screen Flash
 * - Audio
 * - Flashlight (torch)
 *
 * PROPS
 * - icon: MaterialCommunityIcons name (string literal)
 * - active: whether the toggle is on
 * - disabled?: disables interactions + dims the control
 * - onPress: click handler to toggle the setting in the store
 * - accessibilityLabel: screen reader label
 * - style?: optional style overrides
 */

import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/theme/lessonTheme';

const SIZE = 48;

type Props = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  style?: ViewStyle;
};

export default function OutputToggle({
  icon,
  active,
  disabled,
  onPress,
  accessibilityLabel,
  style,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        active && styles.active,      // neon ring + soft glow when active
        disabled && styles.disabled,  // slightly dim when disabled
        pressed && !disabled && { opacity: 0.9 },
        style,
      ]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={22}
        color={active ? colors.blueNeon : 'rgba(154, 160, 166, 0.9)'}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: SIZE,
    height: SIZE,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2A2F36',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#11161C',
  },
  active: {
    borderColor: colors.blueNeon,
    backgroundColor: 'rgba(0, 230, 255, 0.15)',
    shadowColor: colors.blueNeon,
    shadowOpacity: 0.55,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  disabled: {
    opacity: 0.5,
  },
});
