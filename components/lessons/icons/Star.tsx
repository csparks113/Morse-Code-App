// Star icon for MASTERED (lesson send completed)
import React from 'react';
import { Ionicons } from '@expo/vector-icons';

type Props = { size?: number; color?: string };
export default function Star({ size = 22, color = '#FFF' }: Props) {
  return <Ionicons name="star" size={size} color={color} accessibilityLabel="Star icon" accessibilityRole="image"/>;
}
