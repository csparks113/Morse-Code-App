/**
 * RECEIVE SESSION SCREEN (Pinned layout)
 * --------------------------------------
 * Top:    SessionHeader + ProgressBar (fixed)
 * Center: PromptCard (centers in remaining space; only moving part)
 * Bottom: OutputTogglesRow (directly above) + Input (lesson choices OR challenge keyboard)
 *
 * Behavior preserved:
 * - Auto-play on each prompt
 * - Reveal inside PromptCard (above action buttons)
 * - Toggle audio/flash/haptics/torch with OutputTogglesRow
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  Platform,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

// Shared UI
import SessionHeader from '@/components/session/SessionHeader';
import ProgressBar from '@/components/session/ProgressBar';
import SessionSummary from '@/components/session/SessionSummary';
import PromptCard from '@/components/session/PromptCard';
import OutputTogglesRow from '@/components/session/OutputTogglesRow';
import ChallengeKeyboard from '@/components/session/ChallengeKeyboard';

// Theme + utils
import { colors, spacing } from '@/theme/lessonTheme';
import { theme } from '@/theme/theme';
import { toMorse } from '@/utils/morse';
import { playMorseCode, getMorseUnitMs } from '@/utils/audio';

// Stores
import { useProgressStore } from '@/store/useProgressStore';
import { useSettingsStore } from '@/store/useSettingsStore';

// Lesson meta
import { buildSessionMeta } from './sessionMeta';

// Number of questions per session
const TOTAL_QUESTIONS = 20;

type Summary = { correct: number; percent: number };
type FeedbackState = 'idle' | 'correct' | 'wrong';

function formatMorse(code?: string | null) {
  if (!code) return '';
  return code.split('').join(' ');
}

export default function ReceiveSessionScreen() {
  // Route params like /lessons/[group]/[lessonId]
  const { group, lessonId } = useLocalSearchParams<{
    group: string;
    lessonId: string;
  }>();

  // Build lesson metadata (pool, labels, challenge flag)
  const meta = React.useMemo(
    () => buildSessionMeta(group || 'alphabet', lessonId),
    [group, lessonId],
  );

  // Save score to progress store when done
  const setScore = useProgressStore((s) => s.setScore);

  // Settings toggles (audio/flash/haptics)
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

  // Session state
  const [started, setStarted] = React.useState(false);
  const [questions, setQuestions] = React.useState<string[]>([]);
  const [results, setResults] = React.useState<boolean[]>([]);
  const [feedback, setFeedback] = React.useState<FeedbackState>('idle');
  const [showReveal, setShowReveal] = React.useState(false);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [streak, setStreak] = React.useState(0);

  // Visual flash overlay
  const flash = React.useRef(new Animated.Value(0)).current;

  // Timer to delay advancing / scheduling playback
  const advanceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const currentMorseRef = React.useRef('');

  // Current target + Morse code
  const currentIndex = results.length;
  const currentTarget = questions[currentIndex] ?? null;
  const currentMorse = currentTarget ? (toMorse(currentTarget) ?? '') : '';
  currentMorseRef.current = currentMorse;

  // Learned set (for challenge keyboard enablement)
  const learnedSet = React.useMemo(
    () => new Set(meta.pool.map((c) => c.toUpperCase())),
    [meta.pool],
  );

  // Responsive card main slot height (keeps PromptCard compact on small screens)
  const screenH = Dimensions.get('window').height;
  const layout = screenH < 635 ? 'xsmall' : screenH < 700 ? 'small' : 'regular';
  const promptSlotHeight =
    layout === 'regular' ? 116 : layout === 'small' ? 96 : 84;

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  /**
   * Flash overlay for playback feedback.
   */
  const runFlash = React.useCallback(
    (durationMs: number) => {
      if (!lightEnabled) return;
      const fadeDuration = Math.max(80, durationMs * 0.4);

      flash.stopAnimation(() => {
        flash.setValue(1);
        Animated.timing(flash, {
          toValue: 0,
          delay: Math.max(0, durationMs - fadeDuration),
          duration: fadeDuration,
          useNativeDriver: true,
        }).start();
      });
    },
    [flash, lightEnabled],
  );

  /**
   * Haptic tick per symbol during *playback* (optional).
   */
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

  /**
   * Play the target character's Morse pattern using audio/haptics/flash.
   */
  const playTarget = React.useCallback(async () => {
    const morse = currentMorseRef.current;
    if (!morse) return;

    await playMorseCode(morse, getMorseUnitMs(), {
      onSymbolStart: (symbol, duration) => {
        runFlash(duration);
        hapticTick(symbol, duration);
      },
    });
  }, [runFlash, hapticTick]);

  const playTargetRef = React.useRef<() => Promise<void> | void>(() => {});
  React.useEffect(() => {
    playTargetRef.current = playTarget;
  }, [playTarget]);
  /**
   * Auto-play the target shortly after it appears (only while idle on the prompt).
   */
  React.useEffect(() => {
    if (!started || !currentTarget || summary || feedback !== 'idle') return;
    const timer = setTimeout(() => {
      playTargetRef.current?.();
    }, 400);
    return () => clearTimeout(timer);
  }, [started, currentTarget, summary, feedback]);

  /**
   * Start a new receive session (20 random characters from meta.pool).
   */
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
    setSummary(null);
    setStreak(0);
    setStarted(true);
  }, [meta.pool]);

  /**
   * Finish a question and move forward (delay for quick visual feedback).
   */
  const finishQuestion = React.useCallback(
    (isCorrect: boolean) => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      setFeedback(isCorrect ? 'correct' : 'wrong');
      setStreak((prev) => (isCorrect ? prev + 1 : 0));

      advanceTimerRef.current = setTimeout(() => {
        setResults((prev) => {
          if (prev.length >= TOTAL_QUESTIONS) return prev;
          const next = [...prev, isCorrect];

          if (next.length === TOTAL_QUESTIONS) {
            const correctCount = next.filter(Boolean).length;
            const pct = Math.round((correctCount / TOTAL_QUESTIONS) * 100);
            setSummary({ correct: correctCount, percent: pct });
            setStarted(false);
            if (group && lessonId) setScore(group, lessonId, 'receive', pct);
          }
          return next;
        });

        setShowReveal(false);
        setFeedback('idle');
      }, 450);
    },
    [group, lessonId, setScore],
  );

  /**
   * Handle a user choice (from lesson choices or keyboard).
   */
  const submitAnswer = React.useCallback(
    (choice: string) => {
      if (!started || !currentTarget || summary || feedback !== 'idle') return;
      const isCorrect =
        choice.toUpperCase() === (currentTarget ?? '').toUpperCase();
      finishQuestion(isCorrect);
    },
    [started, currentTarget, summary, feedback, finishQuestion],
  );

  // Only interactive when mid-session, idle, and we have a target
  const canInteract =
    started && !summary && !!currentTarget && feedback === 'idle';

  // Large prompt char: '?' during idle thinking, else show the answer
  const visibleChar = !started
    ? ''
    : feedback === 'idle'
      ? '?'
      : (currentTarget ?? '?');

  const progressValue = results.length;

  // Graceful empty state if meta has nothing to quiz on
  if (!meta.pool.length) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Content unavailable.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Finished -> show summary
  if (summary) {
    return (
      <SafeAreaView style={styles.safe}>
        <SessionSummary
          percent={summary.percent}
          correct={summary.correct}
          total={TOTAL_QUESTIONS}
          onContinue={() => {
            if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Flash overlay for playback */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: colors.text,
            opacity: flash.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.2],
            }),
          },
        ]}
      />

      <View style={styles.container}>
        {/* --- TOP (fixed): header + progress --- */}
        <View style={styles.topGroup}>
          <SessionHeader labelTop={meta.headerTop} labelBottom="RECEIVE" />
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
            title="Identify the character"
            started={started}
            visibleChar={visibleChar}
            feedback={feedback}
            morse={currentMorse}
            showReveal={showReveal}
            canInteract={canInteract}
            onStart={startSession}
            onRevealToggle={() => setShowReveal((v) => !v)}
            onReplay={playTarget}
            mainSlotMinHeight={promptSlotHeight}
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

          {/* Input: lesson choices OR challenge keyboard */}
          {meta.isChallenge ? (
            <ChallengeKeyboard
              learnedSet={learnedSet}
              canInteract={canInteract}
              onKeyPress={submitAnswer}
            />
          ) : (
            <View style={styles.lessonChoices}>
              {meta.pool.map((char) => (
                <Pressable
                  key={char}
                  onPress={() => submitAnswer(char)}
                  disabled={!canInteract}
                  style={({ pressed }) => [
                    styles.choice,
                    pressed && styles.choicePressed,
                    !canInteract && { opacity: 0.5 },
                  ]}
                >
                  <Text style={styles.choiceText}>{char}</Text>
                </Pressable>
              ))}
            </View>
          )}
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
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
    paddingBottom: spacing(3),
  },

  // --- layout bands ---------------------------------------------------------
  topGroup: {
    marginBottom: spacing(0),
  },
  centerGroup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center', // centers PromptCard in the available space
  },
  bottomGroup: {
    // stays pinned to bottom
  },

  // --- toggles right above input -------------------------------------------
  togglesWrap: {
    alignSelf: 'stretch',
    paddingHorizontal: spacing(2.5),
    marginBottom: spacing(2.75), // space between toggles and input
  },

  // --- lesson choices row ---------------------------------------------------
  lessonChoices: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing(2),
  },
  choice: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: '#0F151D',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing(3),
  },
  choicePressed: { backgroundColor: '#15202A' },
  choiceText: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 4,
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
});
