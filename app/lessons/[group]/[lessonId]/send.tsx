/**
 * SEND SESSION SCREEN (Morse Code Master)
 * ---------------------------------------
 * OVERVIEW
 * This screen teaches/practices *sending* Morse code for a single character at a time.
 * The app shows a target character (e.g., "E"). The user "keys" the character by
 * pressing the big keyer button: short press = dot (·), long press = dash (–).
 *
 * GOAL
 * - The user must reproduce the target character's Morse sequence (e.g., "E" = ".").
 * - Timing matters: we classify each press as dot/dash using the user's WPM settings.
 * - Gaps between presses should be *intra-character* (1 unit). If not, it's wrong.
 *
 * KEY IDEAS
 * - Timing units come from WPM (getMorseUnitMs). Dot = 1 unit, dash = 3 units.
 * - Gaps: intra = 1 unit, inter = 3 units, word = 7 units (we only accept intra here).
 * - Tolerances (percent) for dot/dash and gaps are configurable in settings.
 * - We generate 20 random prompts from the lesson pool; store correctness; show summary.
 *
 * MAIN FLOW
 * 1) User taps "Start" → we build a 20-item "questions" list from lesson meta.pool.
 * 2) For each question:
 *    - Show the target character (big letter).
 *    - The user presses/releases the big keyer:
 *        onPressIn  → start the timer and check the previous gap.
 *        onPressOut → measure press duration, classify dot/dash, append to input.
 *    - If the input ever deviates from the correct Morse sequence → wrong & advance.
 *    - If it matches exactly → correct & advance.
 * 3) After 20 prompts: compute % correct, save to progress store, show SessionSummary.
 *
 * ACCESSIBILITY & FEEDBACK
 * - Screen flash + haptics on playback (optional via OutputToggle).
 * - Reveal button shows the target's Morse sequence (for learning).
 * - Play button plays audio/haptics/flash pattern of the correct code.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

// Reusable UI components
import SessionHeader from '@/components/session/SessionHeader';
import ProgressBar from '@/components/session/ProgressBar';
import ActionButton from '@/components/session/ActionButton';
import OutputToggle from '@/components/session/OutputToggle';
import SessionSummary from '@/components/session/SessionSummary';

// Theme + utilities
import { colors, spacing } from '@/theme/lessonTheme';
import { toMorse } from '@/utils/morse';
import { playMorseCode, getMorseUnitMs } from '@/utils/audio';

// State stores (Zustand)
import { useProgressStore } from '@/store/useProgressStore';
import { useSettingsStore } from '@/store/useSettingsStore';

// Lesson/session metadata helper
import { buildSessionMeta } from './sessionMeta';

// Number of questions per session
const TOTAL_QUESTIONS = 20;

// Types for local state
type Summary = { correct: number; percent: number };
type GapType = 'intra' | 'inter' | 'word';

/**
 * Turn a press duration into '.' or '-' if it’s within tolerance.
 */
function classifySignalDuration(
  durationMs: number,
  unitMs: number,
  tolerance: number,
): '.' | '-' | null {
  // Target durations for a single press
  const options: Array<{ symbol: '.' | '-'; duration: number }> = [
    { symbol: '.', duration: unitMs }, // dot = 1 unit
    { symbol: '-', duration: unitMs * 3 }, // dash = 3 units
  ];

  // Choose whichever target is *closest* to the actual press time
  let best: { symbol: '.' | '-'; ratio: number } | undefined;
  options.forEach((opt) => {
    const ratio = Math.abs(durationMs - opt.duration) / opt.duration; // % error
    if (!best || ratio < best.ratio) {
      best = { symbol: opt.symbol, ratio };
    }
  });

  // Only accept if within tolerance (% error <= tolerance)
  if (best && best.ratio <= tolerance) return best.symbol;
  return null;
}

/**
 * Turn a *gap* duration into gap type (intra/inter/word) if it’s within tolerance.
 * For send lessons here, we *only accept* intra (1 unit) between symbols of the SAME letter.
 */
function classifyGapDuration(
  durationMs: number,
  unitMs: number,
  tolerance: number,
): GapType | null {
  const options: Array<{ type: GapType; duration: number }> = [
    { type: 'intra', duration: unitMs }, // inside a letter
    { type: 'inter', duration: unitMs * 3 }, // between letters
    { type: 'word', duration: unitMs * 7 }, // between words
  ];

  let best: { type: GapType; ratio: number } | undefined;
  options.forEach((opt) => {
    const ratio = Math.abs(durationMs - opt.duration) / opt.duration;
    if (!best || ratio < best.ratio) {
      best = { type: opt.type, ratio };
    }
  });

  if (best && best.ratio <= tolerance) return best.type;
  return null;
}

export default function SendSessionScreen() {
  // Pull route params like /lessons/[group]/[lessonId]
  const { group, lessonId } = useLocalSearchParams<{
    group: string;
    lessonId: string;
  }>();
  const router = useRouter();
  const homePath = '../../../../(tabs)/index';

  // Build lesson metadata (title, pool of characters, header text)
  const meta = React.useMemo(
    () => buildSessionMeta(group || 'alphabet', lessonId),
    [group, lessonId],
  );

  // Save score to global store on completion
  const setScore = useProgressStore((s) => s.setScore);

  // Settings (toggles + tolerances)
  const settings = useSettingsStore();
  const {
    audioEnabled,
    lightEnabled,
    torchEnabled,
    hapticsEnabled,
    setAudioEnabled,
    setLightEnabled,
    setTorchEnabled,
    setHapticsEnabled,
  } = settings;

  // Tolerance defaults if Settings UI isn’t wired
  const signalTolerancePercent =
    typeof settings.signalTolerancePercent === 'number'
      ? settings.signalTolerancePercent
      : 30; // ±30%
  const gapTolerancePercent =
    typeof settings.gapTolerancePercent === 'number'
      ? settings.gapTolerancePercent
      : 50; // ±50%

  const signalTolerance = signalTolerancePercent / 100;
  const gapTolerance = gapTolerancePercent / 100;

  // Local state for session control
  const [started, setStarted] = React.useState(false);
  const [questions, setQuestions] = React.useState<string[]>([]);
  const [results, setResults] = React.useState<boolean[]>([]);
  const [feedback, setFeedback] = React.useState<'idle' | 'correct' | 'wrong'>(
    'idle',
  );
  const [showReveal, setShowReveal] = React.useState(false);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [input, setInput] = React.useState(''); // typed Morse for current target

  // Keep input in a ref so we can read it in event handlers without re-rendering
  const inputRef = React.useRef('');
  const updateInput = React.useCallback((next: string) => {
    inputRef.current = next;
    setInput(next);
  }, []);

  // Animation & timing refs
  const flash = React.useRef(new Animated.Value(0)).current; // overlay flash
  const pressStartRef = React.useRef<number | null>(null); // when the current press started
  const lastReleaseRef = React.useRef<number | null>(null); // when the last press ended
  const ignorePressRef = React.useRef(false); // used when a wrong gap happens
  const advanceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  ); // debounce next question

  // Current question: target char + its Morse pattern
  const currentIndex = results.length;
  const currentTarget = questions[currentIndex] ?? null;
  const currentMorse = currentTarget ? (toMorse(currentTarget) ?? '') : '';

  // Clear timer on unmount to avoid setState after unmount
  React.useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  /**
   * Visual flash feedback (if screen flash is enabled).
   * We briefly fade a semi-opaque overlay in/out.
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
   * Haptic tick per symbol when *playing* (not when the user keys).
   */
  const hapticTick = React.useCallback(
    async (symbol: '.' | '-') => {
      if (!hapticsEnabled) return;
      try {
        const style =
          symbol === '.'
            ? Haptics.ImpactFeedbackStyle.Light
            : Haptics.ImpactFeedbackStyle.Medium;
        await Haptics.impactAsync(style);
      } catch {
        // Devices without haptics: ignore.
      }
    },
    [hapticsEnabled],
  );

  /**
   * Play the correct pattern (audio/flash/haptics) so the user can hear/feel it.
   */
  const playTarget = React.useCallback(async () => {
    if (!currentMorse) return;
    // getMorseUnitMs should reflect WPM from settings
    await playMorseCode(currentMorse, getMorseUnitMs(), {
      onSymbolStart: (symbol, duration) => {
        runFlash(duration);
        hapticTick(symbol);
      },
    });
  }, [currentMorse, runFlash, hapticTick]);

  /**
   * Wrap up a question and advance (with a tiny delay for visual feedback).
   */
  const finishQuestion = React.useCallback(
    (isCorrect: boolean) => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      setFeedback(isCorrect ? 'correct' : 'wrong');

      // Reset press tracking state
      ignorePressRef.current = false;
      pressStartRef.current = null;
      lastReleaseRef.current = null;

      // Advance after a short delay
      advanceTimerRef.current = setTimeout(() => {
        setResults((prev) => {
          if (prev.length >= TOTAL_QUESTIONS) return prev;
          const next = [...prev, isCorrect];

          // If completed all questions, build summary & store in progress
          if (next.length === TOTAL_QUESTIONS) {
            const correctCount = next.filter(Boolean).length;
            const pct = Math.round((correctCount / TOTAL_QUESTIONS) * 100);
            setSummary({ correct: correctCount, percent: pct });
            setStarted(false);
            if (group && lessonId) {
              setScore(group, lessonId, 'send', pct);
            }
          }
          return next;
        });

        // Reset per-question UI
        updateInput('');
        setShowReveal(false);
        setFeedback('idle');
      }, 450);
    },
    [group, lessonId, setScore, updateInput],
  );

  /**
   * Append a '.' or '-' to the current input and evaluate.
   * - If it *stops matching* the target pattern, it's wrong.
   * - If it *exactly equals* the target pattern, it's correct.
   */
  const appendSymbol = React.useCallback(
    (symbol: '.' | '-') => {
      if (!currentTarget) return;

      const expected = currentMorse;
      const next = `${inputRef.current}${symbol}`;
      updateInput(next);

      if (!expected.startsWith(next)) {
        // e.g. expected '..-' but user typed '.-'
        finishQuestion(false);
        return;
      }
      if (expected === next) {
        // Completed the letter!
        finishQuestion(true);
      }
    },
    [currentTarget, currentMorse, finishQuestion, updateInput],
  );

  /**
   * Build a brand new session:
   * - Make a 20-item question list (random choices from meta.pool).
   * - Reset progress, feedback, and per-question state.
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
    updateInput('');
    setShowReveal(false);
    setFeedback('idle');
    setSummary(null);
    setStarted(true);

    // Reset press/gap tracking
    pressStartRef.current = null;
    lastReleaseRef.current = null;
    ignorePressRef.current = false;
  }, [meta.pool, updateInput]);

  /**
   * True when the user is mid-session and ready to interact.
   */
  const canInteract =
    started && !summary && !!currentTarget && feedback === 'idle';

  /**
   * Handle press DOWN (start timing + validate previous gap).
   */
  const onPressIn = React.useCallback(() => {
    if (!started || summary || !currentTarget || feedback !== 'idle') return;

    const now = Date.now();

    // If we already typed at least one symbol, check the gap since last release
    if (inputRef.current.length > 0 && lastReleaseRef.current !== null) {
      const gapDuration = now - lastReleaseRef.current;

      // For single-letter keying, only *intra-character* (1 unit) is allowed here
      const gapType = classifyGapDuration(
        gapDuration,
        getMorseUnitMs(),
        gapTolerance,
      );
      if (gapType !== 'intra') {
        // Wrong type of gap → mark as wrong and ignore this press
        ignorePressRef.current = true;
        lastReleaseRef.current = null;
        finishQuestion(false);
        return;
      }
    }

    ignorePressRef.current = false;
    pressStartRef.current = now;
  }, [started, summary, currentTarget, feedback, gapTolerance, finishQuestion]);

  /**
   * Handle press UP (measure duration → classify as dot/dash).
   */
  const onPressOut = React.useCallback(() => {
    if (!started || !currentTarget || summary || feedback !== 'idle') return;

    // If a wrong gap already happened in this cycle, ignore this release
    if (ignorePressRef.current) {
      ignorePressRef.current = false;
      pressStartRef.current = null;
      return;
    }

    const startAt = pressStartRef.current;
    pressStartRef.current = null;
    if (!startAt) return;

    const releaseAt = Date.now();
    const duration = releaseAt - startAt;

    // Classify press length as '.' or '-'
    const symbol = classifySignalDuration(
      duration,
      getMorseUnitMs(),
      signalTolerance,
    );
    if (!symbol) {
      lastReleaseRef.current = null;
      finishQuestion(false);
      return;
    }

    // Store release time for upcoming gap checks
    lastReleaseRef.current = releaseAt;

    // Add to input & evaluate
    appendSymbol(symbol);
  }, [
    started,
    currentTarget,
    summary,
    feedback,
    signalTolerance,
    appendSymbol,
    finishQuestion,
  ]);

  // Text helper under the prompt
  const promptText = started
    ? 'Tap to key the Morse code'
    : 'Press start to begin';

  // Close out of the session (back to lessons)
  const handleClose = React.useCallback(() => {
    router.replace(homePath);
  }, [router]);

  // Toggle reveal of the correct Morse code (only while idle on a question)
  const handleReveal = React.useCallback(() => {
    if (!canInteract) return;
    setShowReveal((prev) => !prev);
  }, [canInteract]);

  // If lesson has no content, show graceful empty state
  if (!meta.pool.length) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Content unavailable.</Text>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.emptyBtn,
              pressed && { opacity: 0.92 },
            ]}
          >
            <Text style={styles.emptyBtnText}>Back to Lessons</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // If we’ve finished, show the summary screen
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

  // Otherwise, render the active session UI
  return (
    <SafeAreaView style={styles.safe}>
      {/* Full-screen overlay we animate to produce a quick flash */}
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
        {/* Header with top/bottom labels and close (X) */}
        <SessionHeader
          labelTop={meta.headerTop}
          labelBottom="SEND"
          onClose={handleClose}
        />

        {/* Progress across the 20 questions */}
        <ProgressBar value={results.length} total={TOTAL_QUESTIONS} />

        {/* Prompt area: either Start button or the big target letter */}
        <View style={styles.promptArea}>
          {!started ? (
            <Pressable
              accessibilityRole="button"
              onPress={startSession}
              style={({ pressed }) => [
                styles.startBtn,
                pressed && { opacity: 0.92 },
              ]}
            >
              <Text style={styles.startText}>Start</Text>
            </Pressable>
          ) : (
            <Text
              style={[
                styles.letter,
                feedback === 'correct' && { color: colors.gold },
                feedback === 'wrong' && { color: '#FF6B6B' },
              ]}
            >
              {currentTarget}
            </Text>
          )}
        </View>

        {/* Helper text and reveal of Morse pattern (optional) */}
        <Text style={styles.promptHint}>{promptText}</Text>
        {showReveal && canInteract && (
          <Text style={styles.reveal}>{currentMorse.split('').join(' ')}</Text>
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

        {/* Big keyer surface (where press/hold occurs) */}
        <View style={styles.keyerWrap}>
          <Pressable
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={!canInteract}
            style={({ pressed }) => [
              styles.keyer,
              pressed && styles.keyerPressed,
              !canInteract && { opacity: 0.5 },
            ]}
          >
            <Text style={styles.keyerText}>Tap & Hold to Key</Text>
            {started && (
              <Text style={styles.input}>{input.split('').join(' ')}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

/**
 * Styles: mostly visual polish + consistent spacing.
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
  promptArea: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptHint: {
    color: colors.textDim,
    textAlign: 'center',
    fontSize: 15,
    letterSpacing: 0.6,
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
  letter: {
    fontSize: 110,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 6,
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
  keyerWrap: {
    marginTop: spacing(1),
    alignItems: 'center',
  },
  keyer: {
    width: '100%',
    minHeight: 128,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: '#0F151D',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(1.5),
    paddingHorizontal: spacing(2),
  },
  keyerPressed: {
    backgroundColor: '#15202A',
  },
  keyerText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  input: {
    color: colors.blueNeon,
    fontSize: 20,
    letterSpacing: 6,
    fontWeight: '700',
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
