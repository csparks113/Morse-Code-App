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

export default function ActionButton({ icon, onPress, accessibilityLabel, disabled, active, style }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        active && styles.active,
        disabled && styles.disabled,
        pressed && !disabled && { opacity: 0.92 },
        style,
      ]}
    >
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