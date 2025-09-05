// components/LessonCard.tsx
// -------------------------
// Displays a single lesson: label, the characters covered, and Send/Receive buttons.
// The card hides the "Send" button automatically if settings.receiveOnly === true.

/* import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { theme } from '../constants/theme';
import { useSettingsStore } from '../store/useSettingsStore';

console.log("Rendering LessonsScreen from /(tabs)/index.tsx v2");

type Props = {
  label: string;
  chars: string[];
  onPressReceive: () => void;
  onPressSend: () => void;
};

export default function LessonCard({
  label,
  chars,
  onPressReceive,
  onPressSend,
}: Props) {
  const receiveOnly = useSettingsStore((s) => s.receiveOnly);

  return (
    <View style={styles.card}>
      <View style={{ gap: theme.spacing(1) }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.chars}>{chars.join(', ')}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onPressReceive}
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        >
          <Text style={styles.btnText}>Receive</Text>
        </Pressable>

        {!receiveOnly && (
          <Pressable
            onPress={onPressSend}
            style={({ pressed }) => [
              styles.btnSecondary,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={styles.btnText}>Send</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing(4),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
    gap: theme.spacing(3),
  },
  label: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subtitle,
    fontWeight: '700',
  },
  chars: {
    color: theme.colors.muted,
    fontSize: theme.typography.body,
    letterSpacing: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing(2),
  },
  btn: {
    flex: 1,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing(3),
    alignItems: 'center',
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: theme.colors.textSecondary,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing(3),
    alignItems: 'center',
  },
  btnPressed: {
    opacity: 0.9,
  },
  btnText: {
    color: theme.colors.background,
    fontWeight: '700',
  },
}); */
