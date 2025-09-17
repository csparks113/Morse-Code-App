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
      <Pressable
        accessibilityLabel="Close"
        onPress={onClose}
        style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
      >
        <Ionicons name="close" size={22} color={colors.text} />
      </Pressable>

      <View style={styles.center}>
        <Text style={styles.top}>{labelTop}</Text>
        <Text style={styles.bottom}>{labelBottom}</Text>
      </View>

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
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(3),
    marginBottom: spacing(3),
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
  spacer: { width: 44, height: 44 },
});