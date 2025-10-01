import React from 'react';
import { Animated, Dimensions, Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

import type ActionButton from '@/components/session/ActionButton';
import type { ActionButtonState } from '@/components/session/ActionButton';
import { playMorseCode, getMorseUnitMs } from '@/utils/audio';
import { toMorse } from '@/utils/morse';
import { useProgressStore } from '@/store/useProgressStore';

export const TOTAL_RECEIVE_QUESTIONS = 5;

type Summary = { correct: number; percent: number };
type FeedbackState = 'idle' | 'correct' | 'wrong';

type IconName = React.ComponentProps<typeof ActionButton>['icon'];

type PromptActionLabels = {
  reveal: string;
  replay: string;
};

type PromptActionConfig = {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  state: ActionButtonState;
};

type UseReceiveSessionArgs = {
  pool: string[];
  isChallenge: boolean;
  groupId?: string;
  lessonId?: string;
  lightEnabled: boolean;
  hapticsEnabled: boolean;
  flashOffsetMs?: number;
  hapticOffsetMs?: number;
  actionLabels: PromptActionLabels;
};

type UseReceiveSessionResult = {
  started: boolean;
  summary: Summary | null;
  feedback: FeedbackState;
  showReveal: boolean;
  revealState: ActionButtonState;
  replayState: ActionButtonState;
  revealAction: PromptActionConfig;
  replayAction: PromptActionConfig;
  visibleChar: string;
  hearts: number;
  streak: number;
  progressValue: number;
  canInteract: boolean;
  currentTarget: string | null;
  wpm: number;
  promptSlotHeight: number;
  flashOpacity: Animated.Value;
  startSession: () => void;
  submitAnswer: (choice: string) => void;
  handleRevealPress: () => void;
  handleReplayPress: () => void;
  handleSummaryContinue: () => void;
};

const HEARTS_INITIAL = 3;

function getStoreIdForProgress(rawId: string): string {
  return String(rawId);
}

export function useReceiveSession({
  pool,
  isChallenge,
  groupId,
  lessonId,
  lightEnabled,
  hapticsEnabled,
  flashOffsetMs = 0,
  hapticOffsetMs = 0,
  actionLabels,
}: UseReceiveSessionArgs): UseReceiveSessionResult {
  const setScore = useProgressStore((state) => state.setScore);

  const [started, setStarted] = React.useState(false);
  const [questions, setQuestions] = React.useState<string[]>([]);
  const [results, setResults] = React.useState<boolean[]>([]);
  const [feedback, setFeedback] = React.useState<FeedbackState>('idle');
  const [showReveal, setShowReveal] = React.useState(false);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [streak, setStreak] = React.useState(0);
  const [revealUsed, setRevealUsed] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [hearts, setHearts] = React.useState(HEARTS_INITIAL);

  const flash = React.useRef(new Animated.Value(0)).current;
  const advanceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentMorseRef = React.useRef('');

  const currentIndex = results.length;
  const currentTarget = questions[currentIndex] ?? null;
  const currentMorse = currentTarget ? toMorse(currentTarget) ?? '' : '';
  currentMorseRef.current = currentMorse;

  const screenH = Dimensions.get('window').height;
  const layout = screenH < 635 ? 'xsmall' : screenH < 700 ? 'small' : 'regular';
  const promptSlotHeight = layout === 'regular' ? 116 : layout === 'small' ? 96 : 84;

  React.useEffect(() => {
    return () => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  const runFlash = React.useCallback(
    (durationMs: number) => {
      if (!lightEnabled) return;

      const fadeMs = Math.min(240, Math.max(120, Math.floor(durationMs * 0.35)));
      const holdMs = Math.max(0, Math.floor(durationMs - fadeMs));

      try {
        flash.stopAnimation();
      } catch {
        // no-op
      }
      flash.setValue(1);

      requestAnimationFrame(() => {
        if (holdMs > 0) {
          Animated.timing(flash, {
            toValue: 1,
            duration: holdMs,
            useNativeDriver: true,
          }).start(() => {
            Animated.timing(flash, {
              toValue: 0,
              duration: fadeMs,
              useNativeDriver: true,
            }).start();
          });
        } else {
          Animated.timing(flash, {
            toValue: 0,
            duration: fadeMs,
            useNativeDriver: true,
          }).start();
        }
      });
    },
    [lightEnabled, flash],
  );

  const hapticTick = React.useCallback(
    (symbol: '.' | '-', durationMs: number) => {
      if (!hapticsEnabled) return;

      if (Platform.OS === 'android') {
        try {
          Vibration.cancel();
        } catch {
          // ignore
        }
        Vibration.vibrate(Math.max(15, Math.round(durationMs)));
        return;
      }

      try {
        const style =
          symbol === '.'
            ? Haptics.ImpactFeedbackStyle.Light
            : Haptics.ImpactFeedbackStyle.Medium;
        Haptics.impactAsync(style);
      } catch {
        // ignore
      }
    },
    [hapticsEnabled],
  );

  const playTarget = React.useCallback(async () => {
    if (isPlaying) return;
    const morse = currentMorseRef.current;
    if (!morse) return;

    setIsPlaying(true);
    try {
      await playMorseCode(morse, getMorseUnitMs(), {
        onSymbolStart: (symbol, duration) => {
          if (flashOffsetMs > 0) {
            setTimeout(() => runFlash(duration), flashOffsetMs);
          } else {
            runFlash(duration);
          }

          if (hapticOffsetMs > 0) {
            setTimeout(() => hapticTick(symbol, duration), hapticOffsetMs);
          } else {
            hapticTick(symbol, duration);
          }
        },
      });
    } finally {
      setIsPlaying(false);
    }
  }, [runFlash, hapticTick, flashOffsetMs, hapticOffsetMs, isPlaying]);

  const playTargetRef = React.useRef<() => Promise<void> | void>(() => {});
  React.useEffect(() => {
    playTargetRef.current = playTarget;
  }, [playTarget]);

  React.useEffect(() => {
    if (!started || !currentTarget || summary || feedback !== 'idle') return;
    const timer = setTimeout(() => {
      playTargetRef.current?.();
    }, 400);
    return () => clearTimeout(timer);
  }, [started, currentTarget, summary, feedback]);

  const generateQuestions = React.useCallback(() => {
    if (!pool.length) return [];
    const generated: string[] = [];
    for (let i = 0; i < TOTAL_RECEIVE_QUESTIONS; i += 1) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      generated.push(pick);
    }
    return generated;
  }, [pool]);

  const startSession = React.useCallback(() => {
    if (!pool.length) return;
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
    }

    setQuestions(generateQuestions());
    setResults([]);
    setFeedback('idle');
    setShowReveal(false);
    setRevealUsed(false);
    setIsPlaying(false);
    setSummary(null);
    setStreak(0);
    setStarted(true);
    if (isChallenge) setHearts(HEARTS_INITIAL);
  }, [pool, generateQuestions, isChallenge]);

  const finalizeScore = React.useCallback(
    (answers: boolean[]) => {
      const correctCount = answers.filter(Boolean).length;
      const percent = Math.round((correctCount / TOTAL_RECEIVE_QUESTIONS) * 100);
      const summaryValue: Summary = { correct: correctCount, percent };
      setSummary(summaryValue);
      setStarted(false);
      if (groupId && lessonId) {
        setScore(groupId, getStoreIdForProgress(lessonId), 'receive', percent);
      }
      return summaryValue;
    },
    [groupId, lessonId, setScore],
  );

  const finishQuestion = React.useCallback(
    (isCorrect: boolean) => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
      }

      const willExhaustHearts = isChallenge && !isCorrect && hearts <= 1;

      setFeedback(isCorrect ? 'correct' : 'wrong');
      setShowReveal(true);
      setStreak((prev) => (isCorrect ? prev + 1 : 0));

      if (!isCorrect && isChallenge) {
        setHearts((value) => Math.max(0, value - 1));
      }

      if (willExhaustHearts) {
        const delay = 650;
        setTimeout(() => {
          finalizeScore(results);
        }, delay);
        return;
      }

      advanceTimerRef.current = setTimeout(() => {
        setResults((prev) => {
          if (prev.length >= TOTAL_RECEIVE_QUESTIONS) return prev;
          const next = [...prev, isCorrect];
          if (next.length === TOTAL_RECEIVE_QUESTIONS) {
            finalizeScore(next);
          }
          return next;
        });
        setShowReveal(false);
        setFeedback('idle');
        setRevealUsed(false);
        setIsPlaying(false);
      }, 450);
    },
    [isChallenge, hearts, finalizeScore, results],
  );

  const submitAnswer = React.useCallback(
    (choice: string) => {
      if (!started || !currentTarget || summary || feedback !== 'idle') return;
      const isCorrect = choice.toUpperCase() === (currentTarget ?? '').toUpperCase();
      finishQuestion(isCorrect);
    },
    [started, currentTarget, summary, feedback, finishQuestion],
  );

  const canInteract =
    started && !summary && !!currentTarget && feedback === 'idle' && (!isChallenge || hearts > 0);

  const revealState: ActionButtonState = (() => {
    if (isChallenge) return 'disabled';
    if (!started || !currentTarget || summary) return 'disabled';
    if (revealUsed || showReveal || feedback !== 'idle') return 'disabled';
    return 'active';
  })();

  const replayState: ActionButtonState = (() => {
    if (!started || !currentTarget || summary || (isChallenge && hearts <= 0)) return 'disabled';
    if (isPlaying) return 'disabled';
    if (!canInteract) return 'disabled';
    return 'active';
  })();

  const handleRevealPress = React.useCallback(() => {
    if (revealState !== 'active') return;
    setShowReveal(true);
    setRevealUsed(true);
  }, [revealState]);

  const handleReplayPress = React.useCallback(() => {
    if (replayState !== 'active') return;
    playTarget();
  }, [replayState, playTarget]);

  const revealAction = React.useMemo<PromptActionConfig>(() => ({
    icon: 'eye-outline' as IconName,
    accessibilityLabel: actionLabels.reveal,
    onPress: handleRevealPress,
    state: revealState,
  }), [actionLabels.reveal, handleRevealPress, revealState]);

  const replayAction = React.useMemo<PromptActionConfig>(() => ({
    icon: 'play' as IconName,
    accessibilityLabel: actionLabels.replay,
    onPress: handleReplayPress,
    state: replayState,
  }), [actionLabels.replay, handleReplayPress, replayState]);

  const visibleChar = !started
    ? ''
    : feedback === 'idle'
    ? '?'
    : currentTarget ?? '?';

  const progressValue = results.length;
  const unitMs = getMorseUnitMs();
  const wpm = unitMs > 0 ? 1200 / unitMs : 12;

  const handleSummaryContinue = React.useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
    }
  }, []);

  return {
    started,
    summary,
    feedback,
    showReveal,
    revealState,
    replayState,
    revealAction,
    replayAction,
    visibleChar,
    hearts,
    streak,
    progressValue,
    canInteract,
    currentTarget,
    wpm,
    promptSlotHeight,
    flashOpacity: flash,
    startSession,
    submitAnswer,
    handleRevealPress,
    handleReplayPress,
    handleSummaryContinue,
  };
}















