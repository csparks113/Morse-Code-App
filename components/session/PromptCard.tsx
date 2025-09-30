// components/session/PromptCard.tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import ActionButton, { ActionButtonState } from '@/components/session/ActionButton';
import { colors, spacing } from '@/theme/lessonTheme';
import { useTranslation } from 'react-i18next';

type FeedbackState = 'idle' | 'correct' | 'wrong';

type IconName = React.ComponentProps<typeof ActionButton>['icon'];

type PromptCardAction = {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  state?: ActionButtonState;
};

type Props = {
  title?: string;
  started: boolean;
  visibleChar: string;
  feedback: FeedbackState;
  morse?: string | null;
  showReveal: boolean;
  onStart: () => void;
  onRevealToggle?: () => void;
  onReplay?: () => void;
  canInteract?: boolean;
  mainSlotMinHeight?: number;
  belowReveal?: React.ReactNode;
  compact?: boolean;
  revealSize?: 'sm' | 'md' | 'lg';
  revealAction?: PromptCardAction;
  replayAction?: PromptCardAction;
};

export default function PromptCard({
  title,
  started,
  visibleChar,
  feedback,
/*   morse, */
  showReveal,
  onStart,
  onRevealToggle,
  onReplay,
  canInteract,
/*   mainSlotMinHeight = 116, */
  belowReveal,
/*   compact = false, */
/*   revealSize, */
  revealAction,
  replayAction,
}: Props) {
  const revealVisible = (showReveal || feedback !== 'idle');
  const { t } = useTranslation(['session', 'common']);
  const titleText = title ?? t('session:tapToKey');
  const interactable = canInteract ?? true;

  const resolvedRevealAction = React.useMemo<PromptCardAction>(() => {
    if (revealAction) return revealAction;
    const state: ActionButtonState = (!interactable || !onRevealToggle || showReveal) ? 'disabled' : 'active';
    return {
      icon: 'eye-outline',
      accessibilityLabel: t('session:reveal'),
      onPress: onRevealToggle ?? (() => {}),
      state,
    };
  }, [interactable, onRevealToggle, revealAction, showReveal]);

  const resolvedReplayAction = React.useMemo<PromptCardAction>(() => {
    if (replayAction) return replayAction;
    const disabled = !interactable || !onReplay;
    const state: ActionButtonState = disabled ? 'disabled' : 'active';
    return {
      icon: 'play',
      accessibilityLabel: t('session:replay'),
      onPress: onReplay ?? (() => {}),
      state,
    };
  }, [interactable, onReplay, replayAction]);

  return (
    <View style={[styles.card,]}>

      <Text style={[styles.label]}>{titleText}</Text>

      <View style={[styles.main]}>
        {!started ? (
          <Pressable
            accessibilityRole="button"
            onPress={onStart}
            style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.startText}>{t('common:start')}</Text>
          </Pressable>
        ) : (
          <Text
            style={[
              styles.char,
              feedback === 'correct' && styles.charCorrect,
              feedback === 'wrong' && styles.charWrong,
            ]}
          >
            {visibleChar}
          </Text>
        )}
      </View>

      <View style={[styles.revealMorse]}>
        {belowReveal}
      </View>

      <View style={[styles.actions]}>
        <ActionButton
          icon={resolvedRevealAction.icon}
          accessibilityLabel={resolvedRevealAction.accessibilityLabel}
          onPress={resolvedRevealAction.onPress}
          state={resolvedRevealAction.state}
        />
        <ActionButton
          icon={resolvedReplayAction.icon}
          accessibilityLabel={resolvedReplayAction.accessibilityLabel}
          onPress={resolvedReplayAction.onPress}
          state={resolvedReplayAction.state}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  revealBlock: { minHeight: 60, justifyContent: 'center' },
revealHidden: { opacity: 0, pointerEvents: 'none' },
// --- Main container -------------------------------------------------------------
  card: {
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: '#2A2F36',
    borderRadius: 18,
    paddingHorizontal: spacing(2),
    alignItems: 'center',
    minWidth: 225,
    maxWidth: 560, 
    paddingVertical: spacing(2),
    gap: spacing(1)
,  },

  // --- Text at Top ----------------------------------------------------------------
  label: { 
    color: colors.textDim, 
    textAlign: 'center', 
    letterSpacing: 0.6, 
    fontSize: 15,
  },

  // --- Glyph/Letter & Start Button Outer Container --------------------------------
  main: { 
    alignSelf: 'stretch', 
    alignItems: 'center', 
    justifyContent: 'center', 
    minHeight: 110,
  },

  // --- Glyph/Letter -------------------------------------------------------------
  char: {
    fontSize: 104,
    lineHeight: 104,
    fontWeight: '900',
    color: colors.text,
    //letterSpacing: 6,
    textAlign: 'center',
  },

  charCorrect: { color: colors.gold },

  charWrong: { color: '#FF6B6B' },

  // --- Start Button --------------------------------------------------------------
  startBtn: {
    minWidth: 150,
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

  // --- reveals morse code (correct answer & user input) -----------------
  revealMorse: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  
  // --- action button row --------------------------------------------------
  actions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    gap: spacing(3),
  },
});

