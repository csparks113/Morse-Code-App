// components/session/PromptCard.tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import ActionButton, { ActionButtonState } from '@/components/session/ActionButton';
import { colors, spacing, borders, status, promptCardTheme } from '@/theme/lessonTheme';
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
  showReveal: boolean;
  onStart: () => void;
  morse?: string | null;
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

/**
 * Displays the central prompt card used in send/receive sessions.
 * Until a session starts the card renders a "Start" CTA; afterwards it shows the active glyph
 * along with reveal/replay controls and optional content below the reveal row.
 */
export default function PromptCard({
  title,
  started,
  visibleChar,
  feedback,
  showReveal,
  onStart,
  onRevealToggle,
  onReplay,
  canInteract,
  mainSlotMinHeight = promptCardTheme.main.minHeight,
  belowReveal,
  revealAction,
  replayAction,
}: Props) {
  const { t } = useTranslation(['session', 'common']);
  const titleText = title ?? t('session:tapToKey');
  const interactable = canInteract ?? true;

  const resolvedRevealAction = React.useMemo<PromptCardAction>(() => {
    if (revealAction) return revealAction;
    const state: ActionButtonState = !interactable || !onRevealToggle || showReveal ? 'disabled' : 'active';
    return {
      icon: 'eye-outline',
      accessibilityLabel: t('session:reveal'),
      onPress: onRevealToggle ?? (() => {}),
      state,
    };
  }, [interactable, onRevealToggle, revealAction, showReveal, t]);

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
  }, [interactable, onReplay, replayAction, t]);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{titleText}</Text>

      <View style={[styles.main, { minHeight: mainSlotMinHeight }]}>
        {!started ? (
          <Pressable
            accessibilityRole="button"
            onPress={onStart}
            style={({ pressed }) => [styles.startBtn, pressed && styles.startBtnPressed]}
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

      <View style={styles.reveal}>{belowReveal}</View>

      <View style={styles.actions}>
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
  card: {
    alignSelf: 'center',
    backgroundColor: colors.card,
    borderWidth: promptCardTheme.container.borderWidth,
    borderColor: borders.base,
    borderRadius: promptCardTheme.container.borderRadius,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(2),
    alignItems: 'center',
    minWidth: promptCardTheme.container.minWidth,
    maxWidth: promptCardTheme.container.maxWidth,
    gap: spacing(1),
  },
  label: {
    color: colors.textDim,
    textAlign: 'center',
    letterSpacing: promptCardTheme.label.letterSpacing,
    fontSize: promptCardTheme.label.fontSize,
  },
  main: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  char: {
    fontSize: promptCardTheme.char.fontSize,
    lineHeight: promptCardTheme.char.lineHeight,
    fontWeight: promptCardTheme.char.fontWeight,
    color: colors.text,
    textAlign: 'center',
  },
  charCorrect: { color: colors.gold },
  charWrong: { color: status.error },
  startBtn: {
    minWidth: promptCardTheme.startButton.minWidth,
    paddingVertical: spacing(promptCardTheme.startButton.paddingVerticalStep),
    paddingHorizontal: spacing(promptCardTheme.startButton.paddingHorizontalStep),
    borderRadius: promptCardTheme.startButton.borderRadius,
    backgroundColor: colors.blueNeon,
  },
  startBtnPressed: {
    opacity: 0.9,
  },
  startText: {
    color: colors.bg,
    fontWeight: promptCardTheme.startButton.fontWeight,
    fontSize: promptCardTheme.startButton.fontSize,
    textAlign: 'center',
  },
  reveal: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: promptCardTheme.reveal.minHeight,
  },
  actions: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    gap: spacing(3),
  },
});


