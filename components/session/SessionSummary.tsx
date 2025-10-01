/**
 * SESSION SUMMARY
 * ---------------
 * Full-screen "Session Complete" summary with a circular ring that fills based
 * on the user's score.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import { router } from 'expo-router';
import { colors, spacing, borders, gradients } from '@/theme/lessonTheme';
import { typography, fontWeight } from '@/theme/tokens';
import { useTranslation } from 'react-i18next';

type Props = {
  percent: number;
  correct: number;
  total: number;
  onContinue?: () => void;
};

// Drawing constants for the ring
const SIZE = 220;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export default function SessionSummary({
  percent,
  correct,
  total,
  onContinue,
}: Props) {
  const { t } = useTranslation(['session', 'common']);
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  const strokeId = safePercent >= 80 ? 'ringGold' : 'ringBlue';
  const dash = CIRC * (1 - safePercent / 100);
  const accent = safePercent >= 80 ? colors.gold : colors.blueNeon;
  const [summaryGoldStart, summaryGoldEnd] = gradients.summaryGold;
  const [summaryBlueStart, summaryBlueEnd] = gradients.summaryBlue;

  const handleContinue = React.useCallback(() => {
    onContinue?.();
    router.dismissAll();
    router.replace('/');
  }, [onContinue]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('session:sessionComplete')}</Text>

      <View style={styles.ringWrap}>
        <Svg width={SIZE} height={SIZE}>
          <Defs>
                        <SvgLinearGradient id="ringGold" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={summaryGoldStart} />
              <Stop offset="100%" stopColor={summaryGoldEnd} />
            </SvgLinearGradient>
                        <SvgLinearGradient id="ringBlue" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={summaryBlueStart} />
              <Stop offset="100%" stopColor={summaryBlueEnd} />
            </SvgLinearGradient>
          </Defs>

          {/* Track */}
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={borders.base}
            strokeWidth={STROKE}
            fill="transparent"
          />

          {/* Progress arc */}
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

        {/* Center label */}
        <View style={styles.center}>
          <Text style={[styles.percent, { color: accent }]}>{safePercent}%</Text>
          <Text style={styles.sub}>
            {t('session:correctCount', { correct, total })}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common:continue')}
        onPress={handleContinue}
        style={({ pressed }) => [styles.continue, pressed && styles.continuePressed]}
      >
        <Text style={styles.continueText}>{t('common:continue')}</Text>
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
    fontSize: typography.subtitle,
    fontWeight: fontWeight.extraBold,
  },
  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percent: {
    fontSize: typography.hero,
    fontWeight: fontWeight.black,
    letterSpacing: 1,
  },
  sub: {
    color: colors.textDim,
    marginTop: spacing(1),
    fontWeight: fontWeight.medium,
  },
  continue: {
    backgroundColor: colors.blueNeon,
    borderRadius: 30,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(8),
  },
  continuePressed: { opacity: 0.92 },
  continueText: {
    color: colors.bg,
    fontWeight: fontWeight.extraBold,
    fontSize: typography.subtitle,
  },
});



