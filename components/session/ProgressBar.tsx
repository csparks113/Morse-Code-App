/**
 * PROGRESS BAR WITH STATS
 * -----------------------
 * Displays current question progress and streak info alongside the neon track.
 */

import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme/lessonTheme';

type Props = {
  value: number;
  total: number;
  streak?: number;
};

export default function ProgressBar({ value, total, streak = 0 }: Props) {
  const clampedTotal = total > 0 ? total : 0;
  const answered = Math.max(0, Math.min(value, clampedTotal));
  const fraction = clampedTotal === 0 ? 0 : answered / clampedTotal;
  const percentWidth = `${fraction * 100}%`;
  const safeStreak = Math.max(0, streak);
  const hasStreak = safeStreak > 0;
  const streakColor = hasStreak ? '#FF9F1C' : 'rgba(154, 160, 166, 0.7)';

  return (
    <View style={styles.container}>
      <Text style={styles.countLabel} accessibilityRole="text">
        {answered}/{clampedTotal}
      </Text>

      <View style={styles.track}>
        {fraction > 0 && (
          <LinearGradient
            colors={['#FFEE94', colors.gold]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.fill, { width: percentWidth }]}
          />
        )}
      </View>

      <View style={styles.streakWrap}>
        <Ionicons
          name="flame"
          size={18}
          color={streakColor}
          accessibilityElementsHidden
        />
        <Text style={[styles.streakText, { color: streakColor }]} accessibilityRole="text">
          {safeStreak}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(.25),        //Progress Bar Length (horizontal margins)
    marginBottom: spacing(0),
  },
  countLabel: {
    width: 60,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  track: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  streakWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(0.5),
    minWidth: 46,
    justifyContent: 'center',
  },
  streakText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
