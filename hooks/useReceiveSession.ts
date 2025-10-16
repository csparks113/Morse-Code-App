import React from 'react';
import { Dimensions } from 'react-native';
import type { Animated } from 'react-native';

import type { ActionButtonState } from '@/components/session/ActionButton';
import type { PromptActionLabels, PromptActionConfig, SessionActionIconName } from '@/hooks/sessionActionTypes';
import { useOutputsService, type PlaybackSymbolContext, resolvePlaybackRequestedAt, resolvePlaybackTimelineOffset, buildPlaybackMetadata } from '@/services/outputs/OutputsService';
import { getMorseUnitMs } from '@/utils/audio';
import { toMorse } from '@/utils/morse';
import { useProgressStore } from '@/store/useProgressStore';
import { scheduleMonotonic } from '@/utils/scheduling';
import { nowMs } from '@/utils/time';

export const TOTAL_RECEIVE_QUESTIONS = 5;

type Summary = { correct: number; percent: number };
type FeedbackState = 'idle' | 'correct' | 'wrong';

/**
 * Arguments for configuring the receive session flow.
 * @property actionLabels Localized strings backing the reveal/replay accessibility labels.
 */
type UseReceiveSessionArgs = {
  pool: string[];
  isChallenge: boolean;
  groupId?: string;
  lessonId?: string;
  lightEnabled: boolean;
  hapticsEnabled: boolean;
  audioEnabled: boolean;
  audioVolumePercent: number;
  flashBrightnessPercent: number;
  screenBrightnessBoost: boolean;
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

/**
 * Manages the receive session loop including prompt reveal/replay actions.
 * Pass translated ctionLabels to keep the prompt controls accessible.
 *
 * @example
 * const session = useReceiveSession({
 *   pool,
 *   isChallenge: false,
 *   lightEnabled: true,
 *   hapticsEnabled: true,
 *   actionLabels: { reveal: t('session:reveal'), replay: t('session:replay') },
 * });
 */
export function useReceiveSession({
  pool,
  isChallenge,
  groupId,
  lessonId,
  lightEnabled,
  hapticsEnabled,
  audioEnabled,
  audioVolumePercent,
  flashBrightnessPercent,
  screenBrightnessBoost,
  flashOffsetMs = 0,
  hapticOffsetMs = 0,
  actionLabels,
}: UseReceiveSessionArgs): UseReceiveSessionResult {
  const outputs = useOutputsService();
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

  const flash = React.useRef(outputs.createFlashValue()).current;
  const advanceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentMorseRef = React.useRef('');
  const scheduledCorrelationsRef = React.useRef<Set<string>>(new Set());

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
      outputs.stopMorse();
      flash.stopAnimation?.(() => {
        flash.setValue(0);
      });
    };
  }, [outputs, flash]);

  const runFlash = React.useCallback(
    (durationMs: number, context?: PlaybackSymbolContext) => {
      const requestedAtMs = resolvePlaybackRequestedAt(context);
      const timelineOffsetMs = resolvePlaybackTimelineOffset(context);
      const metadata = buildPlaybackMetadata(context);
      outputs.flashPulse({
        enabled: lightEnabled,
        torchEnabled: false,
        durationMs,
        flashValue: flash,
        source: context?.source ?? 'session.receive',
        requestedAtMs,
        timelineOffsetMs,
        brightnessPercent: flashBrightnessPercent,
        correlationId: context?.correlationId,
        metadata,
      });
    },
    [outputs, lightEnabled, flashBrightnessPercent, flash],
  );

  const hapticTick = React.useCallback(
    (symbol: '.' | '-', durationMs: number, context?: PlaybackSymbolContext) => {
      const requestedAtMs = resolvePlaybackRequestedAt(context);
      const timelineOffsetMs = resolvePlaybackTimelineOffset(context);
      const metadata = buildPlaybackMetadata(context);
      outputs.hapticSymbol({
        enabled: hapticsEnabled,
        symbol,
        durationMs,
        source: context?.source ?? 'session.receive',
        requestedAtMs,
        timelineOffsetMs,
        correlationId: context?.correlationId,
        metadata,
      });
    },
    [outputs, hapticsEnabled],
  );
  const playTarget = React.useCallback(async () => {
    if (isPlaying) return;
    const morse = currentMorseRef.current;
    if (!morse) return;

    setIsPlaying(true);
    try {
      scheduledCorrelationsRef.current.clear();
      await outputs.playMorse({
        morse,
        unitMs: getMorseUnitMs(),
        source: 'session.receive.replay',
        audioEnabled,
        audioVolumePercent,
        flashEnabled: lightEnabled,
        hapticsEnabled,
        torchEnabled: false,
        flashBrightnessPercent,
        screenBrightnessBoost,
        onSymbolStart: (symbol, duration, context) => {
          const playbackStart = resolvePlaybackRequestedAt(context);
          const phase = context?.dispatchPhase ?? 'actual';
          const correlationId = context?.correlationId ?? `${symbol}-${playbackStart ?? nowMs()}`;
          const scheduleKey = correlationId ?? `${symbol}-${playbackStart ?? nowMs()}`;
          if (phase === 'scheduled') {
            scheduledCorrelationsRef.current.add(scheduleKey);
            scheduleMonotonic(
              () => runFlash(duration, context),
              { startMs: playbackStart, offsetMs: flashOffsetMs },
            );
            scheduleMonotonic(
              () => hapticTick(symbol, duration, context),
              { startMs: playbackStart, offsetMs: hapticOffsetMs },
            );
            return;
          }
          if (scheduledCorrelationsRef.current.has(scheduleKey)) {
            return;
          }
          scheduleMonotonic(
            () => runFlash(duration, context),
            { startMs: playbackStart, offsetMs: flashOffsetMs },
          );
          scheduleMonotonic(
            () => hapticTick(symbol, duration, context),
            { startMs: playbackStart, offsetMs: hapticOffsetMs },
          );
        },
      });
    } finally {
      setIsPlaying(false);
    }
  }, [
    outputs,
    runFlash,
    hapticTick,
    flashOffsetMs,
    hapticOffsetMs,
    isPlaying,
    audioEnabled,
    audioVolumePercent,
    lightEnabled,
    hapticsEnabled,
    flashBrightnessPercent,
    screenBrightnessBoost,
  ]);

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

    outputs.stopMorse();
    flash.stopAnimation?.(() => {
      flash.setValue(0);
    });
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
  }, [pool, generateQuestions, isChallenge, outputs, flash]);

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

      outputs.stopMorse();
      flash.stopAnimation?.(() => {
        flash.setValue(0);
      });

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
    [isChallenge, hearts, finalizeScore, results, outputs, flash],
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
    icon: 'eye-outline' as SessionActionIconName,
    accessibilityLabel: actionLabels.reveal,
    onPress: handleRevealPress,
    state: revealState,
  }), [actionLabels.reveal, handleRevealPress, revealState]);

  const replayAction = React.useMemo<PromptActionConfig>(() => ({
    icon: 'play' as SessionActionIconName,
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
    outputs.stopMorse();
    flash.stopAnimation?.(() => {
      flash.setValue(0);
    });
  }, [outputs, flash]);

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























