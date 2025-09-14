// Antenna with waves only (no mast/dot). Used for RECEIVE_DONE state.
import React from 'react';
import { Ionicons } from '@expo/vector-icons';

type Props = { size?: number; color?: string };

export default function AntennaWaves({ size = 22, color = '#FFF' }: Props) {
  return (
    <Ionicons
      name="wifi"
      size={size}
      color={color}
      accessibilityLabel="Antenna waves icon"
      accessibilityRole="image"
    />
  );
}
