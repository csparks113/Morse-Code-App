/**
 * SESSION HEADER (Neon Card)
 * --------------------------
 * OVERVIEW
 * Shared header used by both Send and Receive session screens.
 * Shows:
 *  - a close (X) button on the left
 *  - stacked labels centered in the card:
 *      top: section/lesson title (e.g., "Lesson 1 - E & T" or "Challenge")
 *      bottom: mode ("SEND" or "RECEIVE")
 *
 * PROPS
 * - labelTop: string for the upper label
 * - labelBottom: string for the larger lower label
 * - onClose: handler to exit the session (back to Lessons)
 *
 * DESIGN
 * - Neon outline feel using `glow.neon` from the theme
 * - Tappable close button with pressed feedback
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, glow, radii, spacing } from '@/theme/lessonTheme';

export type SessionHeaderProps = {
  labelTop: string;
  labelBottom: string;
  onClose: () => void;
};

export default function SessionHeader({ labelTop, labelBottom, onClose }: SessionHeaderProps) {
  return (
    <View style={styles.wrap}>
      {/* Left: Close button */}
      <Pressable
        accessibilityLabel="Close"
        onPress={onClose}
        style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
      >
        <Ionicons name="close" size={22} color={colors.text} />
      </Pressable>

      {/* Center: labels */}
      <View style={styles.center}>
        <Text style={styles.top}>{labelTop}</Text>
        <Text style={styles.bottom}>{labelBottom}</Text>
      </View>

      {/* Right: spacer so the center stays truly centered */}
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    // Card appearance
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.border,

    // Spacing
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(3),
    marginBottom: spacing(3),

    // Glow effect for "neon" look
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
  center: { flex: 1, alignItems: 'center', gap: spacing(0.5) },
  top: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  bottom: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
  },
  // Right-side spacer the same size as the close button to balance layout
  spacer: { width: 44, height: 44 },
});
