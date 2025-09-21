// components/session/PromptCard.tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import ActionButton from '@/components/session/ActionButton';
import RevealBar from '@/components/session/RevealBar';
import { colors, spacing } from '@/theme/lessonTheme';

type FeedbackState = 'idle' | 'correct' | 'wrong';

type Props = {
  title?: string;
  started: boolean;
  visibleChar: string;
  feedback: FeedbackState;
  morse?: string | null;
  showReveal: boolean;
  canInteract: boolean;
  onStart: () => void;
  onRevealToggle: () => void;
  onReplay: () => void;
  mainSlotMinHeight?: number;
  belowReveal?: React.ReactNode;
  compact?: boolean;
  revealSize?: 'sm' | 'md' | 'lg';
};

export default function PromptCard({
  title,
  started,
  visibleChar,
  feedback,
  morse,
  showReveal,
  canInteract,
  onStart,
  onRevealToggle,
  onReplay,
  mainSlotMinHeight = 116,
  belowReveal,
  compact = false,
  revealSize,
}: Props) {
  const titleText = title ?? 'Identify the character';
  const revealVisible = (showReveal && started) || feedback !== 'idle';

  // compact spacing
  const padV = compact ? spacing(1.75) : spacing(2.5);
  const gap = compact ? spacing(1) : spacing(1.75);
  const slotMinH = compact ? Math.min(92, mainSlotMinHeight) : mainSlotMinHeight;
  const actionsGap = compact ? spacing(3) : spacing(4);
  const labelSize = compact ? 14 : 15;
  const belowMinH = compact ? 12 : 18;
  const revealSz = revealSize ?? (compact ? 'sm' : 'md');

  return (
    <View style={[styles.card, { paddingVertical: padV, gap }]}>
      <Text style={[styles.label, { fontSize: labelSize }]}>{titleText}</Text>

      <View style={[styles.main, { minHeight: slotMinH }]}>
        {!started ? (
          <Pressable
            accessibilityRole="button"
            onPress={onStart}
            style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.92 }]}
          >
            <Text style={styles.startText}>Start</Text>
          </Pressable>
        ) : (
          <Text
            style={[
              styles.char,
              feedback === 'correct' && { color: colors.gold },
              feedback === 'wrong' && { color: '#FF6B6B' },
            ]}
          >
            {visibleChar}
          </Text>
        )}
      </View>

      <RevealBar morse={morse} visible={!!morse && revealVisible} size={revealSz} />

      <View style={[styles.below, { minHeight: belowMinH }]}>
        {belowReveal}
      </View>

      <View style={[styles.actions, { gap: actionsGap }]}>
        <ActionButton
          icon={showReveal ? 'eye-off-outline' : 'eye-outline'}
          accessibilityLabel="Reveal code"
          onPress={onRevealToggle}
          active={showReveal}
          disabled={!canInteract}
        />
        <ActionButton
          icon="play"
          accessibilityLabel="Play code"
          onPress={onReplay}
          disabled={!canInteract}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: '#2A2F36',
    borderRadius: 18,
    paddingHorizontal: spacing(3),
    alignItems: 'center',
    minWidth: '70%',
    maxWidth: 560,
  },
  label: { color: colors.textDim, textAlign: 'center', letterSpacing: 0.6 },
  main: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },

  // Big letter shown during the question
  char: {
    fontSize: 104,
    lineHeight: 104,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 6,
    textAlign: 'center',
  },

  // Classic Start button (solid)
  startBtn: {
    minWidth: 180,
    paddingVertical: spacing(2.25),
    paddingHorizontal: spacing(5.5),
    borderRadius: 32,
    backgroundColor: colors.blueNeon,
  },
  startText: {
    color: colors.bg,
    fontWeight: '800',
    fontSize: 18,
    textAlign: 'center',
  },

  below: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },

  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
