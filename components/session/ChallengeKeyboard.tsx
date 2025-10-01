// components/session/ChallengeKeyboard.tsx
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { colors, spacing, surfaces, borders } from '@/theme/lessonTheme';
import { withAlpha } from '@/theme/tokens';

export type ChallengeKeyboardProps = {
  rows?: string[][];
  learnedSet: Set<string>;          // which characters are enabled (uppercase)
  canInteract: boolean;             // disable during transitions
  onKeyPress: (key: string) => void;
};

const DEFAULT_LAYOUT: string[][] = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Z','X','C','V','B','N','M'],
];

export default function ChallengeKeyboard({
  rows = DEFAULT_LAYOUT,
  learnedSet,
  canInteract,
  onKeyPress,
}: ChallengeKeyboardProps) {
  return (
    <View style={styles.keyboard}>
      {rows.map((row) => (
        <View key={row.join('-')} style={styles.keyboardRow}>
          {row.map((key) => {
            const learned = learnedSet.has(key.toUpperCase());
            const active = learned && canInteract;
            return (
              <Pressable
                key={key}
                disabled={!learned || !canInteract}
                onPress={() => onKeyPress(key)}
                style={({ pressed }) => [
                  styles.key,
                  learned && styles.keyLearned,
                  active && pressed && styles.keyPressed,
                  !learned && styles.keyDisabled,
                ]}
              >
                <Text style={[styles.keyText, learned ? styles.keyTextActive : styles.keyTextDisabled]}>
                  {key}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    gap: spacing(0.6),
    alignItems: 'center',
  },
  
  keyboardRow: {
    flexDirection: 'row',
    gap: spacing(0.6),
  },
  key: {
    width: 32,
    height: 40,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: borders.key,
    backgroundColor: surfaces.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyLearned: { borderColor: colors.blueNeon },
  keyPressed: { backgroundColor: surfaces.pressed },
  keyDisabled: { opacity: 0.35 },
  keyText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  keyTextActive: { color: colors.text },
  keyTextDisabled: { color: withAlpha(colors.textDim, 0.65) },
});





