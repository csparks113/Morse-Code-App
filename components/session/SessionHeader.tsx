// components/session/SessionHeader.tsx
/**
 * SESSION HEADER - Compact single line
 * ------------------------------------
 * Displays: "<primary> | <MODE>"
 *   - primary: "Lesson 1" or "Challenge" (subtitle like "E & T" is removed)
 *   - MODE: "SEND" or "RECEIVE" (tinted; blue for SEND, gray for RECEIVE)
 *
 * Nav behavior:
 *   - Runs optional onClose() for screen cleanup
 *   - router.dismissAll() then router.replace('/') to land on home without back-loop
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Animated, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, glow, radii, spacing, status, sessionLayoutTheme } from '@/theme/lessonTheme';
import { withAlpha } from '@/theme/tokens';
import { useTranslation } from 'react-i18next';

export type SessionHeaderProps = {
  labelTop: string; // "Lesson 1 - E & T" | "Review" | "Challenge"
  labelBottom: string; // "SEND" | "RECEIVE"
  onClose?: () => void;
  mode?: 'normal' | 'review' | 'challenge';
  hearts?: number; // only meaningful in challenge mode
  exitToHome?: boolean;
  showCloseButton?: boolean;
};

// Keep only "Lesson N" or "Challenge" from labelTop
function extractPrimary(labelTop: string): string {
  const m = labelTop.match(/^(Lesson\s*\d+)|^Challenge|^Review/i);
  if (m) return m[0].replace(/\s+/g, ' ').trim();
  const first = labelTop.split(/[-\u2013\u2014|]/)[0];
  return first.trim() || labelTop.trim();
}

const headerLayout = sessionLayoutTheme.header;
const DEFAULT_SIDE_WIDTH = spacing(headerLayout.sideMinWidthStep);

export default function SessionHeader({
  labelTop,
  labelBottom,
  onClose,
  mode = 'normal',
  hearts = 3,
  exitToHome = true,
  showCloseButton = true,
}: SessionHeaderProps) {
  const { t } = useTranslation(['common', 'session']);
  const handlePressClose = React.useCallback(() => {
    onClose?.();
    if (exitToHome) {
      router.dismissAll();
      router.replace('/');
    }
  }, [onClose, exitToHome]);

  // Compute primary line: prefer explicit mode labels
  let topLine: string;
  if (mode === 'review') {
    topLine = t('common:review');
  } else if (mode === 'challenge') {
    topLine = t('common:challenge');
  } else {
    topLine = extractPrimary(labelTop);
  }
  const bottomLabel = labelBottom;

  const [sideWidth, setSideWidth] = React.useState(DEFAULT_SIDE_WIDTH);

  React.useEffect(() => {
    if (mode !== 'challenge' && sideWidth !== DEFAULT_SIDE_WIDTH) {
      setSideWidth(DEFAULT_SIDE_WIDTH);
    }
  }, [mode, sideWidth]);

  const handleHeartsLayout = React.useCallback(
    (event: LayoutChangeEvent) => {
      const measured = event.nativeEvent.layout.width;
      if (!Number.isFinite(measured)) return;
      const next = Math.max(DEFAULT_SIDE_WIDTH, measured);
      if (Math.abs(next - sideWidth) > 0.5) {
        setSideWidth(next);
      }
    },
    [sideWidth],
  );

  // --- Hearts loss animation (scale + shake) -------------------------------
  const prevHeartsRef = React.useRef<number>(hearts);
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const shakeAnim = React.useRef(new Animated.Value(0)).current; // -1..1

  React.useEffect(() => {
    const prev = prevHeartsRef.current;
    if (mode === 'challenge' && hearts < prev) {
      // bump + shake when a heart is lost
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.12, duration: 90, useNativeDriver: true }),
          Animated.spring(scaleAnim, { toValue: 1, speed: 12, bounciness: 6, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -1, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
        ]),
      ]).start();
    }
    prevHeartsRef.current = hearts;
  }, [hearts, mode, scaleAnim, shakeAnim]);

  return (
    <View style={styles.wrap}>
      <View style={[styles.side, styles.sideLeft, { width: sideWidth }]}>
        {showCloseButton ? (
          <Pressable
            accessibilityLabel={t('common:close')}
            onPress={handlePressClose}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.center}>
        <Text style={styles.top} numberOfLines={1} ellipsizeMode="tail">
          {topLine}
        </Text>
        <Text style={styles.bottom}>{bottomLabel}</Text>
      </View>

      {mode === 'challenge' ? (
        <Animated.View
          onLayout={handleHeartsLayout}
          style={[
            styles.side,
            styles.sideRight,
            { width: sideWidth },
            {
              transform: [
                { scale: scaleAnim },
                {
                  translateX: shakeAnim.interpolate({
                    inputRange: [-1, 1],
                    outputRange: [-3, 3],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.heartsRow}>
            {Array.from({ length: Math.max(0, Math.min(3, hearts)) }).map((_, i) => (
              <Text key={i} style={[styles.heart, styles.heartFull]}>
                {String.fromCharCode(0x2665)}
              </Text>
            ))}
          </View>
        </Animated.View>
      ) : (
        <View style={[styles.side, styles.sideRight, { width: sideWidth }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.border,

    paddingVertical: spacing(headerLayout.paddingVerticalStep),
    paddingHorizontal: spacing(headerLayout.paddingHorizontalStep),
    marginBottom: spacing(headerLayout.marginBottomStep),

    ...glow.neon,
  },
  side: {
    minWidth: DEFAULT_SIDE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideLeft: {
    alignItems: 'flex-start',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  closeBtn: {
    width: DEFAULT_SIDE_WIDTH,
    height: DEFAULT_SIDE_WIDTH,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.blueNeon, 0.12),
  },
  pressed: { opacity: 0.9 },

  center: {
    flex: 1,
    alignItems: 'center',
    gap: spacing(headerLayout.centerGapStep),
    paddingHorizontal: spacing(headerLayout.centerPaddingHorizontalStep),
  },
  top: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  bottom: {
    color: colors.blueNeon,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },

  heart: { fontSize: 16 },
  heartFull: { color: status.error },

  heartsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing(headerLayout.heartsGapStep),
  },
});
