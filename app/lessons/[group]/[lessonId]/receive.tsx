/**
 * RECEIVE SESSION SCREEN (Morse Code Master)
 * ------------------------------------------
 * OVERVIEW
 * This screen teaches/practices *receiving* Morse code for a single character.
 * The app PLAYS a Morse sequence (audio/flash/haptics) and the user must IDENTIFY
 * the correct character (either via 2-choice buttons for lessons or a keyboard for
 * challenges).
 *
 * GOAL
 * - Listen/feel the code for the target character.
 * - Choose the matching character.
 *
 * KEY IDEAS
 * - We derive timing from WPM (getMorseUnitMs). Playback uses playMorseCode().
 * - Output toggles let users enable/disable haptics, screen flash, and audio.
 * - Lessons: small set of multiple-choice buttons (the lesson’s pool).
 * - Challenges: a larger on-screen keyboard (only keys for learned chars are active).
 *
 * MAIN FLOW
 * 1) User taps "Start" → build 20-item questions list from meta.pool.
 * 2) For each question:
 *    - We auto-play the target character’s Morse pattern shortly after it appears.
 *    - The user selects an answer:
 *        correct → mark correct, advance
 *        wrong   → mark wrong, advance
 * 3) After 20 prompts: compute % correct, store in progress, show SessionSummary.
 *
 * ACCESSIBILITY & FEEDBACK
 * - Flash overlay and haptic ticks during playback (if enabled).
 * - Reveal button to show the dot/dash pattern (for learning).
 * - Keyboard disables characters that haven’t been learned yet in this lesson path.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

// Reusable UI
import SessionHeader from '@/components/session/SessionHeader';
import ProgressBar from '@/components/session/ProgressBar';
import ActionButton from '@/components/session/ActionButton';
import OutputToggle from '@/components/session/OutputToggle';
import SessionSummary from '@/components/session/SessionSummary';

// Theme + utils
import { colors, spacing } from '@/theme/lessonTheme';
import { toMorse } from '@/utils/morse';
import { playMorseCode, getMorseUnitMs } from '@/utils/audio';

// Stores
import { useProgressStore } from '@/store/useProgressStore';
import { useSettingsStore } from '@/store/useSettingsStore';

// Lesson meta
import { buildSessionMeta } from './sessionMeta';

// Number of questions per session
const TOTAL_QUESTIONS = 20;

/**
 * Keyboard layout for challenge mode.
 * NOTE: Depending on your design, you can remove numbers or space bar.
 * Here it's letters + numbers, with *only learned* keys enabled.
 */
const KEYBOARD_LAYOUT = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

// Simple summary type
type Summary = { correct: number; percent: number };

// For the large prompt character’s color feedback
type FeedbackState = 'idle' | 'correct' | 'wrong';

/**
 * Pretty-print a Morse string by spacing symbols: ".-" → ". -"
 */
function formatMorse(code?: string | null) {
  if (!code) return '';
  return code.split('').join(' ');
}

export default function ReceiveSessionScreen() {
  // Route params like /lessons/[group]/[lessonId]
  const { group, lessonId } = useLocalSearchParams<{ group: string; lessonId: string }>();
  const router = useRouter();
  const homePath = '../../../../(tabs)/index';

  // Build lesson metadata (pool, labels, challenge flag)
  const meta = React.useMemo(() => buildSessionMeta(group || 'alphabet', lessonId), [group, lessonId]);

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

  // Visual flash overlay
  const flash = React.useRef(new Animated.Value(0)).current;

  // Timer to delay advancing / scheduling playback
  const advanceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Current target + Morse code
  const currentIndex = results.length;
  const currentTarget = questions[currentIndex] ?? null;
  const currentMorse = currentTarget ? toMorse(currentTarget) ?? '' : '';

  // Which keys should be active in challenge mode? (only learned)
  const learnedSet = React.useMemo(() => new Set(meta.pool.map((c) => c.toUpperCase())), [meta.pool]);

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
      flash.stopAnimation();
      flash.setValue(0);
      Animated.sequence([
        Animated.timing(flash, {
          toValue: 0.9,
          duration: Math.min(120, durationMs * 0.6),
          useNativeDriver: true,
        }),
        Animated.timing(flash, {
          toValue: 0,
          duration: Math.max(120, durationMs * 0.6),
          useNativeDriver: true,
        }),
      ]).start();
    },
    [flash, lightEnabled],
  );

  /**
   * Haptic tick per symbol during *playback* (optional).
   */
  const hapticTick = React.useCallback(
    async (symbol: '.' | '-') => {
      if (!hapticsEnabled) return;
      try {
        const style = symbol === '.' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium;
        await Haptics.impactAsync(style);
      } catch {
        // Ignore if hardware not present.
      }
    },
    [hapticsEnabled],
  );

  /**
   * Play the target character’s Morse pattern using audio/haptics/flash.
   */
  const playTarget = React.useCallback(async () => {
    if (!currentMorse) return;
    await playMorseCode(currentMorse, getMorseUnitMs(), {
      onSymbolStart: (symbol, duration) => {
        runFlash(duration);
        hapticTick(symbol);
      },
    });
  }, [currentMorse, runFlash, hapticTick]);

  /**
   * Auto-play the target shortly after it appears (only while idle on the prompt).
   */
  React.useEffect(() => {
    if (!started || !currentTarget || summary || feedback !== 'idle') return;
    const timer = setTimeout(() => {
      playTarget();
    }, 400);
    return () => clearTimeout(timer);
  }, [started, currentTarget, summary, playTarget, feedback]);

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
    setStarted(true);
  }, [meta.pool]);

  /**
   * Finish a question and move forward (delay for quick visual feedback).
   */
  const finishQuestion = React.useCallback(
    (isCorrect: boolean) => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      setFeedback(isCorrect ? 'correct' : 'wrong');

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
              setScore(group, lessonId, 'receive', pct);
            }
          }
          return next;
        });

        setShowReveal(false);
        setFeedback('idle');
      }, 500);
    },
    [group, lessonId, setScore],
  );

  /**
   * Handle a user choice (from lesson choices or keyboard).
   */
  const submitAnswer = React.useCallback(
    (choice: string) => {
      if (!started || !currentTarget || summary || feedback !== 'idle') return;
      const isCorrect = choice.toUpperCase() === (currentTarget ?? '').toUpperCase();
      finishQuestion(isCorrect);
    },
    [started, currentTarget, summary, feedback, finishQuestion],
  );

  /**
   * Close out of session back to lessons.
   */
  const handleClose = React.useCallback(() => {
    router.replace(homePath);
  }, [router]);

  /**
   * Reveal/unreveal the correct Morse sequence (for learning).
   */
  const handleReveal = React.useCallback(() => {
    if (!started || summary || !currentTarget) return;
    setShowReveal((prev) => !prev);
  }, [started, summary, currentTarget]);

  // Only interactive when mid-session, idle, and we have a target
  const canInteract = started && !summary && !!currentTarget && feedback === 'idle';

  // Large prompt char: '?' during idle thinking, else show the answer
  const visibleChar = !started
    ? ''
    : feedback === 'idle'
    ? '?'
    : currentTarget ?? '?';

  const progressValue = results.length;

  // Graceful empty state if meta has nothing to quiz on
  if (!meta.pool.length) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Content unavailable.</Text>
          <Pressable onPress={handleClose} style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.92 }]}>
            <Text style={styles.emptyBtnText}>Back to Lessons</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Finished → show summary
  if (summary) {
    return (
      <SafeAreaView style={styles.safe}>
        <SessionSummary
          percent={summary.percent}
          correct={summary.correct}
          total={TOTAL_QUESTIONS}
          onContinue={handleClose}
        />
      </SafeAreaView>
    );
  }

  // Active session UI
  return (
    <SafeAreaView style={styles.safe}>
      {/* Flash overlay for playback */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: colors.text,
            opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.2] }),
          },
        ]}
      />

      <View style={styles.container}>
        {/* Header with lesson/challenge labels */}
        <SessionHeader
          labelTop={meta.headerTop}
          labelBottom="RECEIVE"
          onClose={handleClose}
        />

        {/* Progress across 20 questions */}
        <ProgressBar value={progressValue} total={TOTAL_QUESTIONS} />

        {/* Prompt area shows large "?" while waiting, then green/red on correctness */}
        <Text style={styles.promptLabel}>Identify the character</Text>
        <View style={styles.promptArea}>
          {!started ? (
            <Pressable
              accessibilityRole="button"
              onPress={startSession}
              style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.92 }]}
            >
              <Text style={styles.startText}>Start</Text>
            </Pressable>
          ) : (
            <Text
              style={[
                styles.promptChar,
                feedback === 'correct' && { color: colors.gold },
                feedback === 'wrong' && { color: '#FF6B6B' },
              ]}
            >
              {visibleChar}
            </Text>
          )}
        </View>

        {/* Optional reveal of Morse string */}
        {showReveal && canInteract && (
          <Text style={styles.reveal}>{formatMorse(currentMorse)}</Text>
        )}

        {/* Action buttons + output toggles */}
        <View style={styles.controls}>
          <View style={styles.actionRow}>
            <ActionButton
              icon={showReveal ? 'eye-off-outline' : 'eye-outline'}
              accessibilityLabel="Reveal code"
              onPress={handleReveal}
              active={showReveal}
              disabled={!canInteract}
            />
            <ActionButton
              icon="play"
              accessibilityLabel="Play code"
              onPress={playTarget}
              disabled={!canInteract}
            />
          </View>

          <View style={styles.toggleRow}>
            <OutputToggle
              icon="vibrate"
              accessibilityLabel="Toggle haptics"
              active={hapticsEnabled}
              onPress={() => setHapticsEnabled(!hapticsEnabled)}
            />
            <OutputToggle
              icon="monitor"
              accessibilityLabel="Toggle screen flash"
              active={lightEnabled}
              onPress={() => setLightEnabled(!lightEnabled)}
            />
            <OutputToggle
              icon="volume-high"
              accessibilityLabel="Toggle audio"
              active={audioEnabled}
              onPress={() => setAudioEnabled(!audioEnabled)}
            />
            <OutputToggle
              icon="flashlight"
              accessibilityLabel="Toggle flashlight"
              active={torchEnabled}
              onPress={() => setTorchEnabled(!torchEnabled)}
            />
          </View>
        </View>

        {/* Choices:
            - For *lessons*: only the lesson’s two characters as big choices.
            - For *challenges*: full keyboard but only learned keys are active. */}
        {meta.isChallenge ? (
          <View style={styles.keyboard}>
            {KEYBOARD_LAYOUT.map((row) => (
              <View key={row.join('-')} style={styles.keyboardRow}>
                {row.map((key) => {
                  const learned = learnedSet.has(key);
                  const active = learned && canInteract;
                  return (
                    <Pressable
                      key={key}
                      disabled={!learned || !canInteract}
                      onPress={() => submitAnswer(key)}
                      style={({ pressed }) => [
                        styles.key,
                        learned && styles.keyLearned,
                        active && pressed && styles.keyPressed,
                        !learned && styles.keyDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.keyText,
                          learned ? styles.keyTextActive : styles.keyTextDisabled,
                        ]}
                      >
                        {key}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
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
    </SafeAreaView>
  );
}

/**
 * Styles: keep consistent padding/spacing & clear visual states.
 */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    flex: 1,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(5),
    paddingBottom: spacing(5),
    gap: spacing(3),
  },
  promptLabel: {
    color: colors.textDim,
    textAlign: 'center',
    fontSize: 15,
    letterSpacing: 0.6,
  },
  promptArea: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtn: {
    minWidth: 180,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(6),
    borderRadius: 32,
    backgroundColor: colors.blueNeon,
  },
  startText: {
    color: colors.bg,
    fontWeight: '800',
    fontSize: 18,
    textAlign: 'center',
  },
  promptChar: {
    fontSize: 104,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 6,
    textAlign: 'center',
  },
  reveal: {
    color: colors.blueNeon,
    fontSize: 24,
    letterSpacing: 6,
    fontWeight: '700',
    textAlign: 'center',
  },
  controls: {
    gap: spacing(3),
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing(2.5),
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 280,
    alignSelf: 'center',
  },
  lessonChoices: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing(2.5),
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
  choicePressed: {
    backgroundColor: '#15202A',
  },
  choiceText: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 4,
  },
  keyboard: {
    gap: spacing(1.5),
    alignItems: 'center',
  },
  keyboardRow: {
    flexDirection: 'row',
    gap: spacing(1.2),
  },
  key: {
    width: 44,
    height: 50,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#1F2933',
    backgroundColor: '#0F151D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyLearned: {
    borderColor: colors.blueNeon,
  },
  keyPressed: {
    backgroundColor: '#15202A',
  },
  keyDisabled: {
    opacity: 0.35,
  },
  keyText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  keyTextActive: {
    color: colors.blueNeon,
  },
  keyTextDisabled: {
    color: '#4A5058',
  },
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
  emptyBtn: {
    backgroundColor: colors.blueNeon,
    borderRadius: 30,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(6),
  },
  emptyBtnText: {
    color: colors.bg,
    fontWeight: '800',
  },
});
