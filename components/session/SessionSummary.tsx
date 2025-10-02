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
import { colors, spacing, borders, gradients, sessionLayoutTheme } from '@/theme/lessonTheme';
import { getSessionFooterSpacing } from '@/theme/sessionStyles';
import { typography, fontWeight } from '@/theme/tokens';
import { useTranslation } from 'react-i18next';

type SummaryProps = {
  percent: number;
  correct: number;
  total: number;
};

type SessionSummaryProps = SummaryProps & {
  onContinue?: () => void;
};

type ContinueProps = {
  onContinue?: () => void;
};

const SUMMARY_FOOTER_SPACING = getSessionFooterSpacing('summary');
const summaryLayout = sessionLayoutTheme.summary;
const summaryStandalone = summaryLayout.standalone;
const summaryContentLayout = summaryLayout.content;
const summaryContinueLayout = summaryLayout.continue;

// Drawing constants for the ring
const SIZE = 220;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

function useSummaryVisuals(percent: number) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
  const isGold = safePercent >= 80;
  const dash = CIRC * (1 - safePercent / 100);
  const accent = isGold ? colors.gold : colors.blueNeon;
  const [summaryGoldStart, summaryGoldEnd] = gradients.summaryGold;
  const [summaryBlueStart, summaryBlueEnd] = gradients.summaryBlue;

  return {
    safePercent,
    dash,
    accent,
    strokeId: isGold ? 'ringGold' : 'ringBlue',
    summaryGoldStart,
    summaryGoldEnd,
    summaryBlueStart,
    summaryBlueEnd,
  } as const;
}

export function SessionSummaryContent({ percent, correct, total }: SummaryProps) {
  const { t } = useTranslation(['session']);
  const {
    safePercent,
    dash,
    accent,
    strokeId,
    summaryGoldStart,
    summaryGoldEnd,
    summaryBlueStart,
    summaryBlueEnd,
  } = useSummaryVisuals(percent);

  return (
    <View style={styles.content}>
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
          <Text style={styles.sub}>{t('session:correctCount', { correct, total })}</Text>
        </View>
      </View>
    </View>
  );
}

export function SessionSummaryContinue({ onContinue }: ContinueProps) {
  const { t } = useTranslation(['common']);

  const handleContinue = React.useCallback(() => {
    onContinue?.();
    router.dismissAll();
    router.replace('/');
  }, [onContinue]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('common:continue')}
      onPress={handleContinue}
      style={({ pressed }) => [styles.continue, pressed && styles.continuePressed]}
    >
      <Text style={styles.continueText}>{t('common:continue')}</Text>
    </Pressable>
  );
}

export default function SessionSummary({ percent, correct, total, onContinue }: SessionSummaryProps) {
  return (
    <View style={styles.standaloneWrap}>
      <SessionSummaryContent percent={percent} correct={correct} total={total} />
      <SessionSummaryContinue onContinue={onContinue} />
    </View>
  );
}

const styles = StyleSheet.create({
  standaloneWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(summaryStandalone.paddingHorizontalStep),
    marginBottom: SUMMARY_FOOTER_SPACING,
    gap: spacing(summaryStandalone.gapStep),
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(summaryContentLayout.paddingHorizontalStep),
    gap: spacing(summaryContentLayout.gapStep),
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
    marginTop: spacing(summaryContentLayout.subLabelMarginTopStep),
    fontWeight: fontWeight.medium,
  },
  continue: {
    alignSelf: 'stretch',
    backgroundColor: colors.blueNeon,
    borderRadius: 30,
    paddingVertical: spacing(summaryContinueLayout.paddingVerticalStep),
    paddingHorizontal: spacing(summaryContinueLayout.paddingHorizontalStep),
    marginBottom: SUMMARY_FOOTER_SPACING,
  },
  continuePressed: { opacity: 0.92 },
  continueText: {
    color: colors.bg,
    fontWeight: fontWeight.extraBold,
    fontSize: typography.subtitle,
  },
});
