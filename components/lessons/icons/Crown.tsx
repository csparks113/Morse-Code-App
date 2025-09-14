// Crown icon for CHALLENGE_MASTERED
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Props = { size?: number; color?: string };
export default function Crown({ size = 22, color = '#FFF' }: Props) {
  return (
    <MaterialCommunityIcons
      name="crown"
      size={size}
      color={color}
      accessibilityLabel="Crown icon"
      accessibilityRole="image"
    />
  );
}
