import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { colors, spacing } from '@/theme/lessonTheme';

type Props = {
  percent: number;
  correct: number;
  total: number;
  onContinue: () => void;
};

const SIZE = 220;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export default function SessionSummary({ percent, correct, total, onContinue }: Props) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  const strokeId = safePercent >= 80 ? 'ringGold' : 'ringBlue';
  const dash = CIRC * (1 - safePercent / 100);
  const accent = safePercent >= 80 ? colors.gold : colors.blueNeon;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Session Complete</Text>

      <View style={styles.ringWrap}>
        <Svg width={SIZE} height={SIZE}>
          <Defs>
            <SvgLinearGradient id="ringGold" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#FFE066" />
              <Stop offset="100%" stopColor={colors.gold} />
            </SvgLinearGradient>
            <SvgLinearGradient id="ringBlue" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#00C2FF" />
              <Stop offset="100%" stopColor={colors.blueDeep} />
            </SvgLinearGradient>
          </Defs>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke="#1C252F"
            strokeWidth={STROKE}
            fill="transparent"
          />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={`url(#${strokeId})`}
            strokeWidth={STROKE}
            fill="transparent"
            strokeLinecap="round"
            strokeDasharray={`${CIRC} ${CIRC}`}
            strokeDashoffset={dash}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <View style={styles.center}>
          <Text style={[styles.percent, { color: accent }]}>{safePercent}%</Text>
          <Text style={styles.sub}>{correct} / {total} correct</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Continue"
        onPress={onContinue}
        style={({ pressed }) => [styles.continue, pressed && { opacity: 0.92 }]}
      >
        <Text style={styles.continueText}>Continue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(4),
    gap: spacing(5),
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percent: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sub: {
    color: colors.textDim,
    marginTop: spacing(1),
    fontWeight: '600',
  },
  continue: {
    backgroundColor: colors.blueNeon,
    borderRadius: 30,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(8),
  },
  continueText: {
    color: colors.bg,
    fontWeight: '800',
    fontSize: 18,
  },
});