/**
 * PROGRESS BAR
 * ------------
 * OVERVIEW
 * Simple horizontal progress bar with a gold gradient fill.
 * Used on the session screens to show progress out of 20 prompts.
 *
 * PROPS
 * - value: current progress count (e.g., number of answered questions)
 * - total: total count (e.g., 20)
 *
 * IMPLEMENTATION
 * - We clamp value/total to a 0..1 fraction and set the fill width to that %.
 * - Uses `expo-linear-gradient` for a nice gold gradient.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '@/theme/lessonTheme';

type Props = {
  value: number;
  total: number;
};

export default function ProgressBar({ value, total }: Props) {
  // Convert to a [0, 1] fraction; guard against bad totals
  const clamped = total <= 0 ? 0 : Math.max(0, Math.min(1, value / total));

  return (
    <View style={styles.track}>
      {/* Only render the fill when > 0 to avoid drawing a tiny sliver */}
      {clamped > 0 && (
        <LinearGradient
          colors={['#FFEE94', colors.gold]}                 // pale gold → rich gold
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
    backgroundColor: 'rgba(255, 215, 0, 0.15)',  // faint gold track
    overflow: 'hidden',
    width: '100%',
    marginBottom: spacing(3),
  },
  fill: {
    height: '100%',
  },
});
