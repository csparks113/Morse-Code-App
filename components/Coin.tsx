// app/components/Coin.tsx
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { coinPalette as palette } from '@/theme/lessonTheme';

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

export default function Coin({
  size = 88,
  color,
  kind,
  children,
  style,
  glow,
}: CoinProps) {
  const fill = {
    blue: palette.blue,
    green: palette.green,
    purple: palette.purple,
    gray: palette.grayCoin,
    silver: palette.silver,
    gold: palette.gold,
  }[color];

  const ringColor = fill;
  const inner = lighten(fill, 0.25);

  return (
    <View style={[{ width: size, alignItems: 'center' }, style]}>
      <View
        style={[
          styles.outer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: ringColor,
          },
          glow && styles.glow,
        ]}
      >
        <View
          style={{
            width: size - 8,
            height: size - 8,
            borderRadius: (size - 8) / 2,
            backgroundColor: inner,
            borderWidth: 2,
            borderColor: '#000',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  glow: {
    shadowColor: '#3AA8FF',
    shadowOpacity: 0.9,
    shadowRadius: 22,
  },
});

function lighten(hex: string, amount = 0.2) {
  const c = hex.replace('#', '');
  const num = parseInt(c, 16);
  const r = Math.min(255, Math.floor(((num >> 16) & 0xff) + 255 * amount))
    .toString(16)
    .padStart(2, '0');
  const g = Math.min(255, Math.floor(((num >> 8) & 0xff) + 255 * amount))
    .toString(16)
    .padStart(2, '0');
  const b = Math.min(255, Math.floor((num & 0xff) + 255 * amount))
    .toString(16)
    .padStart(2, '0');
  return `#${r}${g}${b}`;
}
