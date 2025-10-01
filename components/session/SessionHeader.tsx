// components/session/SessionHeader.tsx
/**
 * SESSION HEADER â€” Compact single line
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
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, glow, radii, spacing } from '@/theme/lessonTheme';
import { useTranslation } from 'react-i18next';

export type SessionHeaderProps = {
  labelTop: string;       // "Lesson 1 - E & T" | "Review" | "Challenge"
  labelBottom: string;    // "SEND" | "RECEIVE"
  onClose?: () => void;
  mode?: 'normal' | 'review' | 'challenge';
  hearts?: number;        // only meaningful in challenge mode
};

// Keep only "Lesson N" or "Challenge" from labelTop
function extractPrimary(labelTop: string): string {
  const m = labelTop.match(/^(Lesson\s*\d+)|^Challenge|^Review/i);
  if (m) return m[0].replace(/\s+/g, ' ').trim();
  const first = labelTop.split(/[-â€“â€”|]/)[0];
  return first.trim() || labelTop.trim();
}

export default function SessionHeader({
  labelTop,
  labelBottom,
  onClose,
  mode = 'normal',
  hearts = 3,
}: SessionHeaderProps) {
  const { t } = useTranslation(['common', 'session']);
  const handlePressClose = React.useCallback(() => {
    onClose?.();
    router.dismissAll();
    router.replace('/');
  }, [onClose]);

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
      {/* Left: Close */}
      <Pressable
        accessibilityLabel={t('common:close')}
        onPress={handlePressClose}
        style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
      >
        <Ionicons name="close" size={22} color={colors.text} />
      </Pressable>

      {/* Center: two lines */}
      <View style={styles.center}>
        <Text style={styles.top} numberOfLines={1} ellipsizeMode="tail">
          {topLine}
        </Text>
        <Text style={styles.bottom}>{bottomLabel}</Text>
      </View>

      {/* Right: hearts only in challenge mode */}
      {mode === 'challenge' ? (
  <Animated.View
    style={[
      styles.right,
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
    <View style={[styles.heartsRow, { flexDirection: 'row-reverse' }]}>
      {Array.from({ length: Math.max(0, Math.min(3, hearts)) }).map((_, i) => (
        <Text key={i} style={[styles.heart, styles.heartFull]}>
          â¤
        </Text>
      ))}
    </View>
  </Animated.View>
) : (
  <View style={styles.spacer} />
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

    paddingVertical: spacing(2),
    paddingHorizontal: spacing(2),
    marginBottom: spacing(1.5),

    ...glow.neon,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 230, 255, 0.12)',
  },
  pressed: { opacity: 0.9 },

  center: { flex: 1, alignItems: 'center', gap: spacing(0), paddingHorizontal: spacing(1) },
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

  spacer: { width: 44, height: 44 },

  heartsWrap: {
    minWidth: 60,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
  },
  heart: { fontSize: 16 },
  heartFull: { color: '#FF5A5F' },
  heartEmpty: { color: '#444' },

  heartsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});

