// components/session/SessionHeader.tsx
/**
 * SESSION HEADER — Compact single line
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
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, glow, radii, spacing } from '@/theme/lessonTheme';

export type SessionHeaderProps = {
  labelTop: string;       // e.g., "Lesson 1 - E & T" or "Challenge"
  labelBottom: string;    // "SEND" or "RECEIVE"
  onClose?: () => void;   // cleanup only — navigation handled here
};

// Keep only "Lesson N" or "Challenge" from labelTop
function extractPrimary(labelTop: string): string {
  const m = labelTop.match(/^(Lesson\s*\d+)|^Challenge/i);
  if (m) return m[0].replace(/\s+/g, ' ').trim();
  const first = labelTop.split(/[-–—|]/)[0];
  return first.trim() || labelTop.trim();
}

export default function SessionHeader({
  labelTop,
  labelBottom,
  onClose,
}: SessionHeaderProps) {
  const handlePressClose = React.useCallback(() => {
    onClose?.();          // cancel timers, audio, etc.
    router.dismissAll();  // prevent back-stack loops
    router.replace('/');  // land on tabs/index (home)
  }, [onClose]);

  const topLine = extractPrimary(labelTop);
  const mode = (labelBottom || '').toUpperCase();

  return (
    <View style={styles.wrap}>
      {/* Left: Close */}
      <Pressable
        accessibilityLabel="Close"
        onPress={handlePressClose}
        style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
      >
        <Ionicons name="close" size={22} color={colors.text} />
      </Pressable>

      {/* Center: two lines (subtitle removed) */}
      <View style={styles.center}>
        <Text style={styles.top} numberOfLines={1} ellipsizeMode="tail">
          {topLine}
        </Text>
        <Text style={styles.bottom}>{mode}</Text>
      </View>

      {/* Right: spacer to keep title centered */}
      <View style={styles.spacer} />
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

    // same paddings as before
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
    color: colors.blueNeon,   // always blue (SEND/RECEIVE)
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
  },

  spacer: { width: 44, height: 44 },
});