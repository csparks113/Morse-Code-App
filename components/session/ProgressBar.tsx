import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '@/theme/lessonTheme';

type Props = {
  value: number;
  total: number;
};

export default function ProgressBar({ value, total }: Props) {
  const clamped = total <= 0 ? 0 : Math.max(0, Math.min(1, value / total));
  return (
    <View style={styles.track}>
      {clamped > 0 && (
        <LinearGradient
          colors={['#FFEE94', colors.gold]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.fill, { width: `${clamped * 100}%` }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    overflow: 'hidden',
    width: '100%',
    marginBottom: spacing(3),
  },
  fill: {
    height: '100%',
  },
});