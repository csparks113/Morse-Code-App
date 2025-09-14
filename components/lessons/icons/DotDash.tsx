// Simple brand mark used inside AVAILABLE challenge/lesson nodes: a dot and a dash.
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

type Props = { size?: number; color?: string; style?: ViewStyle };

export default function DotDash({ size = 20, color = '#FFF', style }: Props) {
  const dotSize = Math.round(size * 0.35);
  const dashW = Math.round(size * 0.7);
  const dashH = Math.max(2, Math.round(size * 0.15));
  return (
    <View style={[styles.row, style]}
      accessibilityLabel="Dot dash icon"
      accessibilityRole="image"
    >
      <View
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: color,
          marginRight: Math.round(size * 0.2),
        }}
      />
      <View
        style={{
          width: dashW,
          height: dashH,
          borderRadius: dashH / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
