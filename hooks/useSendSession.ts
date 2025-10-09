import React from 'react';
import { Animated, Dimensions } from 'react-native';

import type { ActionButtonState } from '@/components/session/ActionButton';
import type { PromptActionLabels, PromptActionConfig, SessionActionIconName } from '@/hooks/sessionActionTypes';
import { useSessionFlow } from '@/hooks/useSessionFlow';
import { useKeyerOutputs } from '@/hooks/useKeyerOutputs';
import { useOutputsService, type PlaybackSymbolContext, resolvePlaybackRequestedAt, buildPlaybackMetadata } from '@/services/outputs/OutputsService';
import { createPressTracker } from '@/services/latency/pressTracker';
import { traceOutputs } from '@/services/outputs/trace';
import { useProgressStore } from '@/store/useProgressStore';
import { toMorse } from '@/utils/morse';
import {
  classifyGapDuration,
  classifySignalDuration,
  getMorseUnitMs,
  MORSE_UNITS,
} from '@/utils/morseTiming';
import { nowMs, toMonotonicTime } from '@/utils/time';

type FeedbackState = 'idle' | 'correct' | 'wrong';
type PressWindow = { startMs: number; endMs: number };
type Summary = { correct: number; percent: number };


const HEARTS_INITIAL = 3;

export const TOTAL_SEND_QUESTIONS = 5;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getStoreIdForProgress(rawId: string): string {
  return String(rawId);
}

/**
 * Arguments for configuring the send session flow.
 * @property actionLabels Localized strings for the reveal/replay prompt actions.
 */
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
  onPressIn: (timestampMs?: number) => void;
  onPressOut: (timestampMs?: number) => void;
  handleRevealPress: () => void;
  handleReplayPress: () => void;
  handleSummaryContinue: () => void;
};

/**
 * Orchestrates the send session prompt/card behaviour and prompt actions.
 * Supply localized ctionLabels so the reveal/replay buttons speak in the user's language.
 *
 * @example
 * const session = useSendSession({
 *   pool,
 *   isChallenge: false,
 *   audioEnabled: true,
 *   hapticsEnabled: true,
 *   lightEnabled: false,
 *   torchEnabled: false,
 *   toneHz: 600,
 *   signalTolerancePercent: 20,
 *   gapTolerancePercent: 20,
 *   actionLabels: { reveal: t('session:reveal'), replay: t('session:replay') },
 * });
 */
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
  const outputs = useOutputsService();
  const setScore = useProgressStore((state) => state.setScore);

  const signalTolerance = clamp(signalTolerancePercent / 100, 0, 0.45);
  const gapTolerance = clamp(gapTolerancePercent / 100, 0, 0.7);

  const pressTracker = React.useMemo(() => createPressTracker('session.send'), []);

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
  }, { source: 'session.send', pressTracker });

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
  const verdictTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const canInteractRef = React.useRef(false);

  const setIgnorePress = React.useCallback(
    (next: boolean, reason: string, meta?: Record<string, unknown>) => {
      const previous = ignorePressRef.current;
      ignorePressRef.current = next;

      const activePress = pressTracker.peek();
      traceOutputs('session.send.ignorePress.set', {
        reason,
        previous,
        value: next,
        changed: previous !== next,
        activePressId: activePress?.id ?? null,
        activePressStartedAt: activePress?.startedAtMs ?? null,
        activePressAgeMs: activePress ? Math.max(0, nowMs() - activePress.startedAtMs) : null,
        ...(meta ?? {}),
      });
    },
    [pressTracker],
  );

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

  const clearVerdictTimer = React.useCallback(() => {
    if (verdictTimerRef.current) {
      clearTimeout(verdictTimerRef.current);
      verdictTimerRef.current = null;
    }
  }, []);

  const clearPlaybackTimeout = React.useCallback(() => {
    flashOpacity.stopAnimation?.(() => {
      flashOpacity.setValue(0);
    });
  }, [flashOpacity]);

  React.useEffect(() => {
    prepare().catch(() => {});
    return () => {
      clearAdvanceTimer();
      clearIdleTimeout();
      clearPlaybackTimeout();
      clearVerdictTimer();
      teardown().catch(() => {});
      outputs.stopMorse();
    };
  }, [prepare, teardown, clearAdvanceTimer, clearIdleTimeout, clearPlaybackTimeout, clearVerdictTimer]);

  const flashSymbol = React.useCallback(
    (durationMs: number, context?: PlaybackSymbolContext) => {
      const requestedAtMs = resolvePlaybackRequestedAt(context);
      const metadata = buildPlaybackMetadata(context);
      outputs.flashPulse({
        enabled: lightEnabled,
        durationMs,
        flashValue: flashOpacity,
        source: context?.source ?? 'session.send.replay',
        requestedAtMs,
        correlationId: context?.correlationId,
        metadata,
      });
    },
    [outputs, lightEnabled, flashOpacity],
  );

  const hapticSymbol = React.useCallback(
    (symbol: '.' | '-', context?: PlaybackSymbolContext) => {
      const requestedAtMs = resolvePlaybackRequestedAt(context);
      const metadata = buildPlaybackMetadata(context);
      outputs.hapticSymbol({
        enabled: hapticsEnabled,
        symbol,
        source: context?.source ?? 'session.send.replay',
        requestedAtMs,
        correlationId: context?.correlationId,
        metadata,
      });
    },
    [outputs, hapticsEnabled],
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
    clearVerdictTimer();
    outputs.stopMorse();

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
    setIgnorePress(false, 'session.start');

    start();
  }, [pool, clearAdvanceTimer, clearIdleTimeout, clearPlaybackTimeout, updateInput, isChallenge, start, pressTracker, setIgnorePress]);

  const finishQuestion = React.useCallback(
    (isCorrect: boolean) => {
      clearAdvanceTimer();
      clearIdleTimeout();
      clearPlaybackTimeout();
      clearVerdictTimer();
      setIsReplaying(false);
      onUp(nowMs());

      const willExhaustHearts = isChallenge && !isCorrect && hearts <= 1;

      setFeedback(isCorrect ? 'correct' : 'wrong');
      if (isCorrect) setShowReveal(true);

      if (!isCorrect && isChallenge) {
        setHearts((value) => Math.max(0, value - 1));
      }

      setIgnorePress(false, 'finishQuestion', { isCorrect });
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
      clearVerdictTimer,
      onUp,
      setIgnorePress,
    ],
  );

  const verdictDelayMs = React.useMemo(() => Math.max(120, Math.min(240, unitMs * 1.2)), [unitMs]);

  const queueVerdict = React.useCallback(
    (isCorrect: boolean) => {
      clearVerdictTimer();
      verdictTimerRef.current = setTimeout(() => {
        verdictTimerRef.current = null;
        finishQuestion(isCorrect);
      }, verdictDelayMs);
    },
    [clearVerdictTimer, finishQuestion, verdictDelayMs],
  );

  const scheduleIdleTimeout = React.useCallback(() => {
    clearIdleTimeout();
    if (!canInteractRef.current) return;
    const timeoutMs = Math.max(600, unitMs * MORSE_UNITS.word * 1.2);
    idleTimeoutRef.current = setTimeout(() => {
      if (!canInteractRef.current) return;
      queueVerdict(false);
    }, timeoutMs);
  }, [clearIdleTimeout, unitMs, queueVerdict]);

  const canInteractBase =
    started && !summary && !earlySummary && !!currentTarget && feedback === 'idle';

  React.useEffect(() => {
    canInteractRef.current = canInteractBase;
  }, [canInteractBase]);

  const onPressIn = React.useCallback(
    (rawTimestamp?: number) => {
      if (!canInteractBase || isReplaying) return;
      clearIdleTimeout();
      clearVerdictTimer();

      const press = pressTracker.begin(rawTimestamp);
      const timestamp = press.startedAtMs;

      if (inputRef.current.length > 0 && lastReleaseRef.current !== null) {
        const gapDuration = timestamp - lastReleaseRef.current;
        const gapType = classifyGapDuration(gapDuration, unitMs, gapTolerance);
        if (gapType !== 'intra') {
          setIgnorePress(true, 'gap.verdict', {
            gapType,
            gapDuration,
            inputLength: inputRef.current.length,
            pressId: press.id,
          });
          lastReleaseRef.current = null;
          queueVerdict(false);
          return;
        }
      }

      setIgnorePress(false, 'press.begin', { pressId: press.id });
      pressStartRef.current = timestamp;
      onDown(timestamp);
    },
    [canInteractBase, isReplaying, unitMs, gapTolerance, queueVerdict, onDown, clearIdleTimeout, clearVerdictTimer, pressTracker, setIgnorePress],
  );

  const appendSymbol = React.useCallback(
    (symbol: '.' | '-') => {
      if (!currentTarget) return;
      const target = currentMorseRef.current;
      const next = `${inputRef.current}${symbol}`;
      updateInput(next);

      if (!target.startsWith(next)) {
        queueVerdict(false);
        return;
      }
      if (target === next) {
        queueVerdict(true);
        return;
      }

      scheduleIdleTimeout();
    },
    [currentTarget, queueVerdict, updateInput, scheduleIdleTimeout],
  );

  const onPressOut = React.useCallback((rawTimestamp?: number) => {
    const releaseAt = toMonotonicTime(rawTimestamp);
    onUp(releaseAt);

    if (!canInteractBase || isReplaying) {
      setIgnorePress(false, 'press.cancelled', {
        cause: !canInteractBase ? 'cannotInteract' : 'replaying',
      });
      pressStartRef.current = null;
      return;
    }

    if (ignorePressRef.current) {
      setIgnorePress(false, 'press.ignoreConsumed');
      pressStartRef.current = null;
      return;
    }

    const startAt = pressStartRef.current;
    pressStartRef.current = null;
    if (!startAt) return;

    const duration = releaseAt - startAt;

    setPresses((prev) => [...prev, { startMs: startAt, endMs: releaseAt }]);

    const symbol = classifySignalDuration(duration, unitMs, signalTolerance);
    if (!symbol) {
      lastReleaseRef.current = null;
      queueVerdict(false);
      return;
    }

    lastReleaseRef.current = releaseAt;
    appendSymbol(symbol);
  }, [canInteractBase, isReplaying, unitMs, signalTolerance, queueVerdict, appendSymbol, onUp, setIgnorePress]);

  const handleSummaryContinue = React.useCallback(() => {
    clearAdvanceTimer();
    clearIdleTimeout();
    clearPlaybackTimeout();
    clearVerdictTimer();
    outputs.stopMorse();
  }, [clearAdvanceTimer, clearIdleTimeout, clearPlaybackTimeout, clearVerdictTimer]);

  const playCurrentTarget = React.useCallback(async () => {
    if (isReplaying) return;
    const morse = currentMorseRef.current;
    if (!morse) return;

    setIsReplaying(true);
    clearIdleTimeout();
    try {
      await outputs.playMorse({
        morse,
        unitMs,
        source: 'session.send.replay',
        onSymbolStart: (symbol, durationMs, context) => {
          hapticSymbol(symbol, context);
          flashSymbol(durationMs, context);
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


































































