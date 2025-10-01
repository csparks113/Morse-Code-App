// components/session/ChallengeKeyboard.tsx
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { colors, spacing, surfaces, borders, sessionControlTheme } from '@/theme/lessonTheme';
import { withAlpha } from '@/theme/tokens';

export type ChallengeKeyboardProps = {
  rows?: string[][];
  learnedSet: Set<string>;          // which characters are enabled (uppercase)
  canInteract: boolean;             // disable during transitions
  onKeyPress: (key: string) => void;
};

const challengeKeyboardTheme = sessionControlTheme.challengeKeyboard;
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
    gap: spacing(challengeKeyboardTheme.rowGapStep),
    alignItems: 'center',
  },
  
  keyboardRow: {
    flexDirection: 'row',
    gap: spacing(challengeKeyboardTheme.rowGapStep),
  },
  key: {
    width: challengeKeyboardTheme.key.width,
    height: challengeKeyboardTheme.key.height,
    borderRadius: challengeKeyboardTheme.key.borderRadius,
    borderWidth: challengeKeyboardTheme.key.borderWidth,
    borderColor: borders.key,
    backgroundColor: surfaces.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyLearned: { borderColor: colors.blueNeon },
  keyPressed: { backgroundColor: surfaces.pressed },
  keyDisabled: { opacity: 0.35 },
  keyText: {
    fontSize: challengeKeyboardTheme.key.fontSize,
    fontWeight: '800',
    letterSpacing: challengeKeyboardTheme.key.letterSpacing,
  },
  keyTextActive: { color: colors.text },
  keyTextDisabled: { color: withAlpha(colors.textDim, 0.65) },
});







