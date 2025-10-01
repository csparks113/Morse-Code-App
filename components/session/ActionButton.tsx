/**
 * ACTION BUTTON
 * -------------
 * Compact icon button used under the prompt card. Supports two visual states:
 * - active: neon highlight (available action)
 * - disabled: dimmed (unavailable or temporarily locked)
 */

import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, surfaces, borders, icons } from '@/theme/lessonTheme';

const SIZE = 58;

export type ActionButtonState = 'active' | 'disabled';

type Props = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  state?: ActionButtonState;
  /** @deprecated use `state` */
  active?: boolean;
  /** @deprecated use `state` */
  disabled?: boolean;
  style?: ViewStyle;
};

export default function ActionButton({
  icon,
  onPress,
  accessibilityLabel,
  state,
  active,
  disabled,
  style,
}: Props) {
  const resolvedState: ActionButtonState = React.useMemo(() => {
    if (state) return state;
    if (disabled) return 'disabled';
    if (active) return 'active';
    return 'active';
  }, [state, active, disabled]);

  const isDisabled = resolvedState === 'disabled';

  const iconColor = React.useMemo(() => {
    return resolvedState === 'active' ? colors.blueNeon : icons.disabled;
  }, [resolvedState]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: isDisabled, selected: resolvedState === 'active' }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        resolvedState === 'active' && styles.active,
        resolvedState === 'disabled' && styles.disabled,
        pressed && !isDisabled && styles.touchFeedback,
        style,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={28} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: SIZE,
    height: SIZE,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: borders.subtle,
    backgroundColor: surfaces.keyer,
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
    borderColor: borders.muted,
    backgroundColor: surfaces.disabled,
    opacity: 0.55,
  },
  touchFeedback: {
    opacity: 0.9,
  },
});
