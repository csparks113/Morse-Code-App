// Shield icon for CHALLENGE_RECEIVE_DONE
import React from 'react';
import { Ionicons } from '@expo/vector-icons';

type Props = { size?: number; color?: string };
export default function Shield({ size = 22, color = '#FFF' }: Props) {
  return <Ionicons name="shield" size={size} color={color} accessibilityLabel="Shield icon" accessibilityRole="image"/>;
}
