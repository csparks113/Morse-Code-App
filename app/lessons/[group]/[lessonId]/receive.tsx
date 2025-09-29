// app/lessons/[group]/[lessonId]/receive.tsx

/**
 * RECEIVE SESSION SCREEN (Pinned layout)
 * --------------------------------------
 * Top:    SessionHeader + ProgressBar
 * Center: PromptCard (timeline compare under reveal)
 * Bottom: OutputTogglesRow + Input (LessonChoices OR ChallengeKeyboard)
 *
 * Updates:
 * - Reviews use cumulative pool + keyboard (like challenges).
 * - Challenge hearts: decrement on wrong; early end at 0.
 * - Reviews persist progress under their own ids ("2-review", etc.).
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

// Shared UI
import SessionHeader from '../../../../components/session/SessionHeader';
import ProgressBar from '../../../../components/session/ProgressBar';
import SessionSummary from '../../../../components/session/SessionSummary';
import PromptCard from '../../../../components/session/PromptCard';
import OutputTogglesRow from '../../../../components/session/OutputTogglesRow';
import FlashOverlay from '../../../../components/session/FlashOverlay';
import LessonChoices from '../../../../components/session/LessonChoices';
import MorseCompare from '../../../../components/session/MorseCompare';
import ChallengeKeyboard from '../../../../components/session/ChallengeKeyboard';

// Theme + utils
import { colors, spacing } from '../../../../theme/lessonTheme';
import { theme } from '../../../../theme/theme';
import { toMorse } from '../../../../utils/morse';
import { playMorseCode, getMorseUnitMs } from '../../../../utils/audio';

// Stores
import { useProgressStore } from '../../../../store/useProgressStore';
import { useSettingsStore } from '../../../../store/useSettingsStore';

// Lesson meta
import { buildSessionMeta } from '../../../../session/sessionMeta';

const TOTAL_QUESTIONS = 5;

type Summary = { correct: number; percent: number };
type FeedbackState = 'idle' | 'correct' | 'wrong';

// Normalize to a string key for progress storage
function getStoreIdForProgress(rawId: string) {
  return String(rawId);
}

export default function ReceiveSessionScreen() {
  const { group, lessonId } = useLocalSearchParams<{
    group: string;
    lessonId: string;
  }>();

  const { t } = useTranslation(['session', 'common']);
  const meta = React.useMemo(
    () => buildSessionMeta(group || 'alphabet', lessonId),
    [group, lessonId],
  );

  const isReview = React.useMemo(
    () => /^\d+-review$/.test(String(lessonId)),
    [lessonId]
  );

  const setScore = useProgressStore((s) => s.setScore);

  const {
    audioEnabled,
    lightEnabled,
    torchEnabled,
    hapticsEnabled,
    setAudioEnabled,
    setLightEnabled,
    setTorchEnabled,
    setHapticsEnabled,
  } = useSettingsStore();

  // Optional per-channel offsets (defaults to 0 if not present)
  const { flashOffsetMs = 0, hapticOffsetMs = 0 } = useSettingsStore() as any;

  const [started, setStarted] = React.useState(false);
  const [questions, setQuestions] = React.useState<string[]>([]);
  const [results, setResults] = React.useState<boolean[]>([]);
  const [feedback, setFeedback] = React.useState<FeedbackState>('idle');
  const [showReveal, setShowReveal] = React.useState(false);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [streak, setStreak] = React.useState(0);
  const [revealUsed, setRevealUsed] = React.useState(false);
  const [isPlaying, setIsPlaying] = React.useState(false);

  // Hearts for CHALLENGE mode
  const [hearts, setHearts] = React.useState(3);
  // (Receive does not need a separate earlySummary object - we can set `summary` directly)

  const flash = React.useRef(new Animated.Value(0)).current;

  const advanceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentMorseRef = React.useRef('');

  const currentIndex = results.length;
  const currentTarget = questions[currentIndex] ?? null;
  const currentMorse = currentTarget ? (toMorse(currentTarget) ?? '') : '';
  currentMorseRef.current = currentMorse;

  const learnedSet = React.useMemo(
    () => new Set(meta.pool.map((c) => c.toUpperCase())),
    [meta.pool],
  );

  const screenH = Dimensions.get('window').height;
  const layout = screenH < 635 ? 'xsmall' : screenH < 700 ? 'small' : 'regular';
  const promptSlotHeight =
    layout === 'regular' ? 116 : layout === 'small' ? 96 : 84;

  React.useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  /** Flash overlay for playback feedback */
  const runFlash = React.useCallback((durationMs: number) => {
    if (!lightEnabled) return;

    const fadeMs = Math.min(240, Math.max(120, Math.floor(durationMs * 0.35)));
    const holdMs = Math.max(0, Math.floor(durationMs - fadeMs));

    try {
      flash.stopAnimation();
    } catch {}
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
  }, [lightEnabled, flash]);

  /** Haptic tick per symbol during playback (optional) */
  const hapticTick = React.useCallback(
    (symbol: '.' | '-', durationMs: number) => {
      if (!hapticsEnabled) return;

      if (Platform.OS === 'android') {
        try {
          Vibration.cancel();
        } catch {}
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
        /* ignore */
      }
    },
    [hapticsEnabled],
  );

  /** Play the target character's Morse pattern */
  const playTarget = React.useCallback(async () => {
    if (isPlaying) return;
    const morse = currentMorseRef.current;
    if (!morse) return;

    setIsPlaying(true);
    try {
      await playMorseCode(morse, getMorseUnitMs(), {
        onSymbolStart: (symbol, duration) => {
          if (flashOffsetMs > 0) setTimeout(() => runFlash(duration), flashOffsetMs);
          else runFlash(duration);

          if (hapticOffsetMs > 0) setTimeout(() => hapticTick(symbol, duration), hapticOffsetMs);
          else hapticTick(symbol, duration);
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

  /** Auto-play shortly after the prompt appears (only while idle on the prompt). */
  React.useEffect(() => {
    if (!started || !currentTarget || summary || feedback !== 'idle') return;
    const timer = setTimeout(() => {
      playTargetRef.current?.();
    }, 400);
    return () => clearTimeout(timer);
  }, [started, currentTarget, summary, feedback]);

  /** Start a new receive session */
  const startSession = React.useCallback(() => {
    if (!meta.pool.length) return;
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);

    const generated: string[] = [];
    for (let i = 0; i < TOTAL_QUESTIONS; i += 1) {
      const pick = meta.pool[Math.floor(Math.random() * meta.pool.length)];
      generated.push(pick);
    }

    setQuestions(generated);
    setResults([]);
    setFeedback('idle');
    setShowReveal(false);
    setRevealUsed(false);
    setIsPlaying(false);
    setSummary(null);
    setStreak(0);
    setStarted(true);

    // Reset hearts for challenges
    if (meta.isChallenge) setHearts(3);
  }, [meta.pool, meta.isChallenge]);

  /** Finish a question and move forward (delay for quick visual feedback) */
  const finishQuestion = React.useCallback(
    (isCorrect: boolean) => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);

      const willExhaustHearts =
        meta.isChallenge && !isCorrect && hearts <= 1; // this wrong will drop to 0

      setFeedback(isCorrect ? 'correct' : 'wrong');
      setShowReveal(true);

      if (!isCorrect && meta.isChallenge) {
        setHearts((h) => Math.max(0, h - 1));
      }

      if (willExhaustHearts) {
        // Keep the red state on screen briefly, then end.
        const delay = 650;
        setTimeout(() => {
          const correctCount = results.filter(Boolean).length; // last was wrong
          const pct = Math.round((correctCount / TOTAL_QUESTIONS) * 100);
          setSummary({ correct: correctCount, percent: pct });
          setStarted(false);
          if (group && lessonId) {
            setScore(group, getStoreIdForProgress(String(lessonId)), 'receive', pct);
          }
        }, delay);
        return; // do NOT schedule advance/reset
      }

      // Normal advance path
      advanceTimerRef.current = setTimeout(() => {
        setResults((prev) => {
          if (prev.length >= TOTAL_QUESTIONS) return prev;
          const next = [...prev, isCorrect];
          if (next.length === TOTAL_QUESTIONS) {
            const correctCount = next.filter(Boolean).length;
            const pct = Math.round((correctCount / TOTAL_QUESTIONS) * 100);
            setSummary({ correct: correctCount, percent: pct });
            setStarted(false);
            if (group && lessonId) {
              setScore(group, getStoreIdForProgress(String(lessonId)), 'receive', pct);
            }
          }
          return next;
        });
        setShowReveal(false);
        setFeedback('idle');
        setRevealUsed(false);
        setIsPlaying(false);
      }, 450);
    },
    [group, lessonId, meta.isChallenge, hearts, results, setScore],
  );

  /** Handle a user choice */
  const submitAnswer = React.useCallback(
    (choice: string) => {
      if (!started || !currentTarget || summary || feedback !== 'idle') return;
      const isCorrect =
        choice.toUpperCase() === (currentTarget ?? '').toUpperCase();
      finishQuestion(isCorrect);
    },
    [started, currentTarget, summary, feedback, finishQuestion],
  );


  const canInteract =
    started && !summary && !!currentTarget && feedback === 'idle' && (!meta.isChallenge || hearts > 0);

  const revealVisible = showReveal || feedback !== 'idle';
  const revealDisabled = meta.isChallenge || !canInteract || revealUsed;
  const revealActive = !meta.isChallenge && started && !summary && !revealUsed;
  const revealIcon = revealVisible ? 'eye-off-outline' : 'eye-outline';

  const replayDisabled = !canInteract || isPlaying;
  const replayActive = !replayDisabled;

  const handleRevealPress = React.useCallback(() => {
    if (revealDisabled) return;
    setShowReveal(true);
    setRevealUsed(true);
  }, [revealDisabled]);

  const handleReplayPress = React.useCallback(() => {
    if (replayDisabled) return;
    playTarget();
  }, [replayDisabled, playTarget]);

  // Large prompt char: '?' while guessing, else show the answer at result frame
  const visibleChar = !started
    ? ''
    : feedback === 'idle'
      ? '?'
      : (currentTarget ?? '?');

  const progressValue = results.length;

  // Compute WPM for the timeline (matches your audio timing)
  const unitMs = getMorseUnitMs();
  const wpm = unitMs > 0 ? 1200 / unitMs : 12;

  // Empty state
  if (!meta.pool.length) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{t('session:contentUnavailable')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Summary
  if (summary) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.summaryContainer}>
          <SessionHeader
            labelTop={meta.headerTop}
            labelBottom={t('session:receiveMode')}
            mode={meta.isChallenge ? 'challenge' : isReview ? 'review' : 'normal'}
            hearts={meta.isChallenge ? hearts : undefined}
          />

          <SessionSummary
            percent={summary.percent}
            correct={summary.correct}
            total={TOTAL_QUESTIONS}
            onContinue={() => {
              if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Flash overlay for playback */}
      <FlashOverlay opacity={flash} color={colors.text} maxOpacity={0.28} />

      <View style={styles.container}>
        {/* --- TOP (fixed): header + progress --- */}
        <View style={styles.topGroup}>
          <SessionHeader
            labelTop={meta.headerTop}
            labelBottom={t('session:receiveMode')}
            mode={meta.isChallenge ? 'challenge' : isReview ? 'review' : 'normal'}
            hearts={meta.isChallenge ? hearts : undefined}
          />

          <ProgressBar
            value={progressValue}
            total={TOTAL_QUESTIONS}
            streak={streak}
          />
        </View>

        {/* --- CENTER (flex, centered): PromptCard only --- */}
        <View style={styles.centerGroup}>
          <PromptCard
            compact
            revealSize="sm"
            title={t('session:identifyCharacter')}
            started={started}
            visibleChar={visibleChar}
            feedback={feedback}
            morse={''} // disable old text reveal (avoid duplicates)
            showReveal={showReveal}
            onStart={startSession}
            revealAction={{
              icon: revealIcon,
              accessibilityLabel: t('session:reveal'),
              onPress: handleRevealPress,
              active: revealActive,
              disabled: revealDisabled,
            }}
            replayAction={{
              icon: 'play',
              accessibilityLabel: t('session:replay'),
              onPress: handleReplayPress,
              active: replayActive,
              disabled: replayDisabled,
            }}
            mainSlotMinHeight={promptSlotHeight}
            belowReveal={
              (showReveal || feedback !== 'idle') && currentTarget ? (
                <MorseCompare
                  mode="compare"
                  char={currentTarget}
                  presses={[]}
                  wpm={wpm}
                  size="md"
                  topColor={colors.blueNeon}
                  bottomColor={colors.gold}
                  align="center"
                />
              ) : null
            }
          />
        </View>

        {/* --- BOTTOM (fixed): toggles above input --- */}
        <View style={styles.bottomGroup}>
          <View style={styles.togglesWrap}>
            <OutputTogglesRow
              hapticsEnabled={hapticsEnabled}
              lightEnabled={lightEnabled}
              audioEnabled={audioEnabled}
              torchEnabled={torchEnabled}
              setHapticsEnabled={setHapticsEnabled}
              setLightEnabled={setLightEnabled}
              setAudioEnabled={setAudioEnabled}
              setTorchEnabled={setTorchEnabled}
            />
          </View>

          <View style={[styles.inputZone]}>
            {meta.isChallenge || isReview ? (
              <ChallengeKeyboard
                learnedSet={learnedSet}
                canInteract={canInteract}
                onKeyPress={submitAnswer}
              />
            ) : (
              <LessonChoices
                choices={meta.pool}
                disabled={!canInteract}
                onChoose={submitAnswer}
                style={styles.lessonChoices}
              />
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

/**
 * Styles
 */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },

  container: {
    flex: 1,
    paddingHorizontal: spacing(3),
    paddingTop: spacing(2),
    paddingBottom: spacing(2),
    justifyContent: 'space-between'
  },

  // --- layout bands ---------------------------------------------------------
  topGroup: {
    marginBottom: spacing(.5),
  },

  centerGroup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomGroup: {
    marginTop: spacing(.50,),
    alignItems: 'stretch', 
  },

  // --- toggles right above input -------------------------------------------
  togglesWrap: {
    alignSelf: 'stretch',
    minHeight: 64,        
    justifyContent: 'center',
  },

  // --- input container -----------------------------------------------------
  inputZone: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140
  },

  // --- lesson choices row ---------------------------------------------------
  lessonChoices: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing(2),
  },

  // --- empty state ----------------------------------------------------------
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(4),
    padding: spacing(4),
  },

  emptyText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },

  summaryContainer: {
    flex: 1,
    paddingHorizontal: spacing(3),
    paddingTop: spacing(2),
    paddingBottom: spacing(2),
  },



});








