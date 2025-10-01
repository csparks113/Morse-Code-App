import React from 'react';
import { Animated, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';

import type ActionButton from '@/components/session/ActionButton';
import type { ActionButtonState } from '@/components/session/ActionButton';
import { useSessionFlow } from '@/hooks/useSessionFlow';
import { useKeyerOutputs } from '@/hooks/useKeyerOutputs';
import { useProgressStore } from '@/store/useProgressStore';
import { playMorseCode, stopPlayback } from '@/utils/audio';
import { toMorse } from '@/utils/morse';
import {
  classifyGapDuration,
  classifySignalDuration,
  getMorseUnitMs,
  MORSE_UNITS,
} from '@/utils/morseTiming';

type FeedbackState = 'idle' | 'correct' | 'wrong';
type PressWindow = { startMs: number; endMs: number };
type Summary = { correct: number; percent: number };
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


const HEARTS_INITIAL = 3;

export const TOTAL_SEND_QUESTIONS = 5;

const nowMs = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getStoreIdForProgress(rawId: string): string {
  return String(rawId);
}

type UseSendSessionArgs = {
  pool: string[];
  isChallenge: boolean;
  groupId?: string;
  lessonId?: string;
  audioEnabled: boolean;
  hapticsEnabled: boolean;
  lightEnabled: boolean;
  torchEnabled: boolean;
  toneHz: number;
  signalTolerancePercent: number;
  gapTolerancePercent: number;
  actionLabels: PromptActionLabels;
};

type UseSendSessionResult = {
  started: boolean;
  currentTarget: string | null;
  visibleChar: string;
  compareMode: 'compare' | 'guessing';
  revealAction: PromptActionConfig;
  replayAction: PromptActionConfig;
  feedback: FeedbackState;
  showReveal: boolean;
  revealState: ActionButtonState;
  replayState: ActionButtonState;
  hearts: number;
  streak: number;
  progressValue: number;
  promptSlotHeight: number;
  keyerMinHeight: number;
  wpm: number;
  presses: PressWindow[];
  flashOpacity: Animated.Value;
  finalSummary: Summary | null;
  canInteract: boolean;
  isReplaying: boolean;
  startSession: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  handleRevealPress: () => void;
  handleReplayPress: () => void;
  handleSummaryContinue: () => void;
};

export function useSendSession({
  pool,
  isChallenge,
  groupId,
  lessonId,
  audioEnabled,
  hapticsEnabled,
  lightEnabled,
  torchEnabled,
  toneHz,
  signalTolerancePercent,
  gapTolerancePercent,
  actionLabels,
}: UseSendSessionArgs): UseSendSessionResult {
  const setScore = useProgressStore((state) => state.setScore);

  const signalTolerance = clamp(signalTolerancePercent / 100, 0, 0.45);
  const gapTolerance = clamp(gapTolerancePercent / 100, 0, 0.7);

  const {
    started,
    summary,
    start,
    results,
    streak,
    currentTarget,
    setResult,
  } = useSessionFlow({
    pool,
    total: TOTAL_SEND_QUESTIONS,
    onFinished: ({ percent }) => {
      if (groupId && lessonId) {
        setScore(groupId, getStoreIdForProgress(lessonId), 'send', percent);
      }
    },
  });

  const { onDown, onUp, flashOpacity, prepare, teardown } = useKeyerOutputs({
    audioEnabled,
    hapticsEnabled,
    lightEnabled,
    torchEnabled,
    toneHz,
  });

  const [feedback, setFeedback] = React.useState<FeedbackState>('idle');
  const [showReveal, setShowReveal] = React.useState(false);
  const [revealUsed, setRevealUsed] = React.useState(false);
  const [presses, setPresses] = React.useState<PressWindow[]>([]);
  const [hearts, setHearts] = React.useState(HEARTS_INITIAL);
  const [earlySummary, setEarlySummary] = React.useState<Summary | null>(null);
  const [isReplaying, setIsReplaying] = React.useState(false);
  const [, setInput] = React.useState('');

  const inputRef = React.useRef('');
  const currentMorseRef = React.useRef('');
  const pressStartRef = React.useRef<number | null>(null);
  const lastReleaseRef = React.useRef<number | null>(null);
  const ignorePressRef = React.useRef(false);
  const advanceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const canInteractRef = React.useRef(false);

  const updateInput = React.useCallback((next: string) => {
    inputRef.current = next;
    setInput(next);
  }, []);

  const clearAdvanceTimer = React.useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  const clearIdleTimeout = React.useCallback(() => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  }, []);

  const clearPlaybackTimeout = React.useCallback(() => {
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    prepare().catch(() => {});
    return () => {
      clearAdvanceTimer();
      clearIdleTimeout();
      clearPlaybackTimeout();
      teardown().catch(() => {});
      stopPlayback();
    };
  }, [prepare, teardown, clearAdvanceTimer, clearIdleTimeout, clearPlaybackTimeout]);

  const flashSymbol = React.useCallback(
    (durationMs: number) => {
      if (!lightEnabled) return;
      flashOpacity.stopAnimation?.(() => {});
      flashOpacity.setValue(1);
      clearPlaybackTimeout();
      const fadeDelay = Math.max(0, durationMs);
      playbackTimeoutRef.current = setTimeout(() => {
        Animated.timing(flashOpacity, {
          toValue: 0,
          duration: Math.min(120, Math.max(45, durationMs * 0.6)),
          useNativeDriver: true,
        }).start();
        playbackTimeoutRef.current = null;
      }, fadeDelay);
    },
    [lightEnabled, flashOpacity, clearPlaybackTimeout],
  );

  const hapticSymbol = React.useCallback(
    (symbol: '.' | '-') => {
      if (!hapticsEnabled) return;
      const style = symbol === '-' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
      Haptics.impactAsync(style).catch(() => {});
    },
    [hapticsEnabled],
  );

  const screenH = Dimensions.get('window').height;
  const layout = screenH < 635 ? 'xsmall' : screenH < 700 ? 'small' : 'regular';
  const promptSlotHeight = layout === 'regular' ? 116 : layout === 'small' ? 96 : 84;
  const keyerMinHeight = layout === 'regular' ? 128 : layout === 'small' ? 104 : 92;

  const currentMorse = currentTarget ? toMorse(currentTarget) ?? '' : '';
  currentMorseRef.current = currentMorse;

  const unitMs = getMorseUnitMs();
  const wpm = unitMs > 0 ? 1200 / unitMs : 12;

  const startSession = React.useCallback(() => {
    if (!pool.length) return;
    clearAdvanceTimer();
    clearIdleTimeout();
    clearPlaybackTimeout();
    stopPlayback();

    setIsReplaying(false);
    updateInput('');
    setPresses([]);
    setShowReveal(false);
    setRevealUsed(false);
    setFeedback('idle');
    setEarlySummary(null);
    if (isChallenge) setHearts(HEARTS_INITIAL);

    pressStartRef.current = null;
    lastReleaseRef.current = null;
    ignorePressRef.current = false;

    start();
  }, [pool, clearAdvanceTimer, clearIdleTimeout, clearPlaybackTimeout, updateInput, isChallenge, start]);

  const finishQuestion = React.useCallback(
    (isCorrect: boolean) => {
      clearAdvanceTimer();
      clearIdleTimeout();
      clearPlaybackTimeout();
      setIsReplaying(false);

      const willExhaustHearts = isChallenge && !isCorrect && hearts <= 1;

      setFeedback(isCorrect ? 'correct' : 'wrong');
      if (isCorrect) setShowReveal(true);

      if (!isCorrect && isChallenge) {
        setHearts((value) => Math.max(0, value - 1));
      }

      ignorePressRef.current = false;
      pressStartRef.current = null;
      lastReleaseRef.current = null;

      if (willExhaustHearts) {
        advanceTimerRef.current = setTimeout(() => {
          const correctCount = results.filter(Boolean).length;
          const percent = Math.round((correctCount / TOTAL_SEND_QUESTIONS) * 100);
          const early = { correct: correctCount, percent } as Summary;
          setEarlySummary(early);
          if (groupId && lessonId) {
            setScore(groupId, getStoreIdForProgress(lessonId), 'send', percent);
          }
          advanceTimerRef.current = null;
        }, 650);
        return;
      }

      advanceTimerRef.current = setTimeout(() => {
        setResult(isCorrect);
        updateInput('');
        setPresses([]);
        setShowReveal(false);
        setRevealUsed(false);
        setFeedback('idle');
        advanceTimerRef.current = null;
      }, 650);
    },
    [
      isChallenge,
      hearts,
      results,
      groupId,
      lessonId,
      setScore,
      setResult,
      updateInput,
      clearAdvanceTimer,
      clearIdleTimeout,
      clearPlaybackTimeout,
    ],
  );

  const scheduleIdleTimeout = React.useCallback(() => {
    clearIdleTimeout();
    if (!canInteractRef.current) return;
    const timeoutMs = Math.max(600, unitMs * MORSE_UNITS.word * 1.2);
    idleTimeoutRef.current = setTimeout(() => {
      if (!canInteractRef.current) return;
      finishQuestion(false);
    }, timeoutMs);
  }, [clearIdleTimeout, unitMs, finishQuestion]);

  const canInteractBase =
    started && !summary && !earlySummary && !!currentTarget && feedback === 'idle';

  React.useEffect(() => {
    canInteractRef.current = canInteractBase;
  }, [canInteractBase]);

  const onPressIn = React.useCallback(() => {
    if (!canInteractBase || isReplaying) return;
    clearIdleTimeout();

    const timestamp = nowMs();

    if (inputRef.current.length > 0 && lastReleaseRef.current !== null) {
      const gapDuration = timestamp - lastReleaseRef.current;
      const gapType = classifyGapDuration(gapDuration, unitMs, gapTolerance);
      if (gapType !== 'intra') {
        ignorePressRef.current = true;
        lastReleaseRef.current = null;
        finishQuestion(false);
        return;
      }
    }

    ignorePressRef.current = false;
    pressStartRef.current = timestamp;
    onDown();
  }, [canInteractBase, isReplaying, unitMs, gapTolerance, finishQuestion, onDown, clearIdleTimeout]);

  const appendSymbol = React.useCallback(
    (symbol: '.' | '-') => {
      if (!currentTarget) return;
      const target = currentMorseRef.current;
      const next = `${inputRef.current}${symbol}`;
      updateInput(next);

      if (!target.startsWith(next)) {
        finishQuestion(false);
        return;
      }
      if (target === next) {
        finishQuestion(true);
        return;
      }

      scheduleIdleTimeout();
    },
    [currentTarget, finishQuestion, updateInput, scheduleIdleTimeout],
  );

  const onPressOut = React.useCallback(() => {
    onUp();

    if (!canInteractBase || isReplaying) {
      ignorePressRef.current = false;
      pressStartRef.current = null;
      return;
    }

    if (ignorePressRef.current) {
      ignorePressRef.current = false;
      pressStartRef.current = null;
      return;
    }

    const startAt = pressStartRef.current;
    pressStartRef.current = null;
    if (!startAt) return;

    const releaseAt = nowMs();
    const duration = releaseAt - startAt;

    setPresses((prev) => [...prev, { startMs: startAt, endMs: releaseAt }]);

    const symbol = classifySignalDuration(duration, unitMs, signalTolerance);
    if (!symbol) {
      lastReleaseRef.current = null;
      finishQuestion(false);
      return;
    }

    lastReleaseRef.current = releaseAt;
    appendSymbol(symbol);
  }, [canInteractBase, isReplaying, unitMs, signalTolerance, finishQuestion, appendSymbol, onUp]);

  const handleSummaryContinue = React.useCallback(() => {
    clearAdvanceTimer();
    clearIdleTimeout();
    clearPlaybackTimeout();
    stopPlayback();
  }, [clearAdvanceTimer, clearIdleTimeout, clearPlaybackTimeout]);

  const playCurrentTarget = React.useCallback(async () => {
    if (isReplaying) return;
    const morse = currentMorseRef.current;
    if (!morse) return;

    setIsReplaying(true);
    clearIdleTimeout();
    try {
      await playMorseCode(morse, unitMs, {
        onSymbolStart: (symbol, durationMs) => {
          hapticSymbol(symbol);
          flashSymbol(durationMs);
        },
      });
    } catch (error) {
      console.warn('send replay failed', error);
    } finally {
      clearPlaybackTimeout();
      flashOpacity.stopAnimation?.(() => {});
      flashOpacity.setValue(0);
      setIsReplaying(false);
    }
  }, [isReplaying, unitMs, hapticSymbol, flashSymbol, clearIdleTimeout, clearPlaybackTimeout, flashOpacity]);

  const revealState: ActionButtonState = (() => {
    if (isChallenge) return 'disabled';
    if (!started || !currentTarget || summary || earlySummary || isReplaying) return 'disabled';
    if (showReveal || revealUsed || feedback !== 'idle') return 'disabled';
    return 'active';
  })();

  const replayState: ActionButtonState = (() => {
    if (!started || !currentTarget || summary || earlySummary) return 'disabled';
    if (isReplaying) return 'disabled';
    return 'active';
  })();

  const handleRevealPress = React.useCallback(() => {
    if (revealState !== 'active') return;
    setShowReveal(true);
    setRevealUsed(true);
    clearIdleTimeout();
  }, [revealState, clearIdleTimeout]);

  const handleReplayPress = React.useCallback(() => {
    if (replayState !== 'active') return;
    playCurrentTarget().catch(() => {});
  }, [replayState, playCurrentTarget]);

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

  const finalSummary = earlySummary || summary || null;
  const progressValue = results.length;
  const canInteract = canInteractBase && !isReplaying;
  const visibleChar = started ? currentTarget ?? '' : '';
  const compareMode: 'compare' | 'guessing' = showReveal || feedback === 'correct' ? 'compare' : 'guessing';

  return {
    started,
    currentTarget,
    visibleChar,
    compareMode,
    feedback,
    showReveal,
    revealState,
    replayState,
    revealAction,
    replayAction,
    hearts,
    streak,
    progressValue,
    promptSlotHeight,
    keyerMinHeight,
    wpm,
    presses,
    flashOpacity,
    finalSummary,
    canInteract,
    isReplaying,
    startSession,
    onPressIn,
    onPressOut,
    handleRevealPress,
    handleReplayPress,
    handleSummaryContinue,
  };
}






















