// app/components/Coin.tsx
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { palette } from '@/constants/coinTheme';

type CoinKind = 'lesson' | 'challenge';
type CoinColor = 'blue' | 'green' | 'purple' | 'gray' | 'silver' | 'gold';

export interface CoinProps {
  size?: number; // default 88
  color: CoinColor;
  kind: CoinKind; // lesson vs challenge (affects inner slot)
  children?: React.ReactNode; // Morse or icon
  style?: ViewStyle;
  glow?: boolean; // active state
}

export default function Coin({ size = 88, color, kind, children, style, glow }: CoinProps) {
  const bg = {
    blue: palette.blue,
    green: palette.green,
    purple: palette.purple,
    gray: palette.grayCoin,
    silver: palette.silver,
    gold: palette.gold,
  }[color];

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          shadowColor: '#000',
          shadowOpacity: 0.55,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
        },
        glow && styles.glow,
        style,
      ]}
    >
      {/* Beveled ring */}
      <View style={[styles.ring, { borderRadius: size / 2 - 4 }]} />
      {/* Inner slot for Morse or icon */}
      <View style={styles.slot}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center', alignItems: 'center' },
  ring: {
    position: 'absolute',
    top: 4,
    right: 4,
    bottom: 4,
    left: 4,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  glow: {
    shadowColor: '#3AA8FF',
    shadowOpacity: 0.9,
    shadowRadius: 22,
  },
  slot: { justifyContent: 'center', alignItems: 'center' },
});
