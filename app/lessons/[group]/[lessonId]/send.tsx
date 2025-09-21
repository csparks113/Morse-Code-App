// app/lessons/[group]/[lessonId]/send.tsx
/**
 * SEND SESSION SCREEN (Pinned layout)
 * -----------------------------------
 * Top:    SessionHeader + ProgressBar (fixed)
 * Middle: PromptCard (centered in remaining space)
 * Bottom: OutputTogglesRow (directly above) + Keyer button (fixed to bottom)
 *
 * Other features:
 * - Typed input shows inside PromptCard under reveal; auto-reveal on result
 * - Keyer has pulsing fill + shimmer while interactive
 * - Uses the accepted two-line SessionHeader (subtitle removed) and navigation handled there
 */

// app/lessons/[group]/[lessonId]/send.tsx
/**
 * SEND SESSION SCREEN (Pinned layout + outline shimmer)
 * - Keyer: shimmering OUTLINE + solid fill (pulses on press)
 * - Start button gets the same outline shimmer
 * - Extra margin between toggles and keyer
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

// Shared UI components
import SessionHeader from '@/components/session/SessionHeader';
import ProgressBar from '@/components/session/ProgressBar';
import SessionSummary from '@/components/session/SessionSummary';
import PromptCard from '@/components/session/PromptCard';
import OutputTogglesRow from '@/components/session/OutputTogglesRow';

// Theme + utilities
import { colors, spacing } from '@/theme/lessonTheme';
import { theme } from '@/theme/theme';
import { toMorse } from '@/utils/morse';
import { playMorseCode, getMorseUnitMs } from '@/utils/audio';

// Stores
import { useProgressStore } from '@/store/useProgressStore';
import { useSettingsStore } from '@/store/useSettingsStore';

// Lesson/session metadata helper
import { buildSessionMeta } from './sessionMeta';

const TOTAL_QUESTIONS = 20;

type Summary = { correct: number; percent: number };
type GapType = 'intra' | 'inter' | 'word';

function classifySignalDuration(
  durationMs: number,
  unitMs: number,
  tolerance: number,
): '.' | '-' | null {
  const targets: Array<{ symbol: '.' | '-'; duration: number }> = [
    { symbol: '.', duration: unitMs }, // dot = 1 unit
    { symbol: '-', duration: unitMs * 3 }, // dash = 3 units
  ];
  let best: { symbol: '.' | '-'; ratio: number } | undefined;
  for (const t of targets) {
    const ratio = Math.abs(durationMs - t.duration) / t.duration;
    if (!best || ratio < best.ratio) best = { symbol: t.symbol, ratio };
  }
  return best && best.ratio <= tolerance ? best.symbol : null;
}

function classifyGapDuration(
  durationMs: number,
  unitMs: number,
  tolerance: number,
): GapType | null {
  const targets: Array<{ type: GapType; duration: number }> = [
    { type: 'intra', duration: unitMs }, // inside a letter
    { type: 'inter', duration: unitMs * 3 }, // between letters
    { type: 'word', duration: unitMs * 7 }, // between words
  ];
  let best: { type: GapType; ratio: number } | undefined;
  for (const t of targets) {
    const ratio = Math.abs(durationMs - t.duration) / t.duration;
    if (!best || ratio < best.ratio) best = { type: t.type, ratio };
  }
  return best && best.ratio <= tolerance ? best.type : null;
}

export default function SendSessionScreen() {
  // Route params like /lessons/[group]/[lessonId]
  const { group, lessonId } = useLocalSearchParams<{
    group: string;
    lessonId: string;
  }>();

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

  // Local state
  const [started, setStarted] = React.useState(false);
  const [questions, setQuestions] = React.useState<string[]>([]);
  const [results, setResults] = React.useState<boolean[]>([]);
  const [feedback, setFeedback] = React.useState<'idle' | 'correct' | 'wrong'>(
    'idle',
  );
  const [showReveal, setShowReveal] = React.useState(false);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [input, setInput] = React.useState(''); // typed Morse for current target

  // Refs
  const inputRef = React.useRef('');
  const updateInput = React.useCallback((next: string) => {
    inputRef.current = next;
    setInput(next);
  }, []);

  const flash = React.useRef(new Animated.Value(0)).current; // overlay flash

  const pressStartRef = React.useRef<number | null>(null);
  const lastReleaseRef = React.useRef<number | null>(null);
  const ignorePressRef = React.useRef(false);
  const advanceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Current question: target char + its Morse pattern
  const currentIndex = results.length;
  const currentTarget = questions[currentIndex] ?? null;
  const currentMorse = currentTarget ? (toMorse(currentTarget) ?? '') : '';

  // Responsive tuning for compact UI
  const screenH = Dimensions.get('window').height;
  const layout =
    screenH < 635 ? 'xsmall' :
    screenH < 700 ? 'small' : 'regular';
  const promptSlotHeight = layout === 'regular' ? 116 : layout === 'small' ? 96 : 84;
  const keyerMinHeight   = layout === 'regular' ? 128 : layout === 'small' ? 104 : 92;
  const inputFontSize    = layout === 'regular' ? 20 : layout === 'small' ? 18 : 16;

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  /**
   * Visual flash feedback (if screen flash is enabled).
   */
  const runFlash = React.useCallback(
    (durationMs: number) => {
      if (!lightEnabled) return;
      flash.stopAnimation();
      flash.setValue(0);
      Animated.sequence([
        Animated.timing(flash, {
          toValue: 1,
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
      } catch {}
    },
    [hapticsEnabled],
  );

  /**
   * Play the correct pattern (audio/flash/haptics) so the user can hear/feel it.
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
   * Finish current question and advance.
   */
  const finishQuestion = React.useCallback(
    (isCorrect: boolean) => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      setFeedback(isCorrect ? 'correct' : 'wrong');
      setShowReveal(true); // always reveal the correct code for comparison

      ignorePressRef.current = false;
      pressStartRef.current = null;
      lastReleaseRef.current = null;

      advanceTimerRef.current = setTimeout(() => {
        setResults((prev) => {
          if (prev.length >= TOTAL_QUESTIONS) return prev;
          const next = [...prev, isCorrect];

          if (next.length === TOTAL_QUESTIONS) {
            const correctCount = next.filter(Boolean).length;
            const pct = Math.round((correctCount / TOTAL_QUESTIONS) * 100);
            setSummary({ correct: correctCount, percent: pct });
            setStarted(false);
            if (group && lessonId) setScore(group, lessonId, 'send', pct);
          }
          return next;
        });

        // reset per-question UI
        updateInput('');
        setShowReveal(false);
        setFeedback('idle');
      }, 650);
    },
    [group, lessonId, setScore, updateInput],
  );

  /**
   * Append a '.' or '-' to the current input and evaluate.
   */
  const appendSymbol = React.useCallback(
    (symbol: '.' | '-') => {
      if (!currentTarget) return;

      const expected = currentMorse;
      const next = `${inputRef.current}${symbol}`;
      updateInput(next);

      if (!expected.startsWith(next)) {
        // diverged → wrong
        finishQuestion(false);
        return;
      }
      if (expected === next) {
        // completed correctly
        finishQuestion(true);
      }
    },
    [currentTarget, currentMorse, finishQuestion, updateInput],
  );

  /**
   * Build a brand new session:
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
    if (!canInteract) return;

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
        // Wrong gap → mark wrong and ignore this press
        ignorePressRef.current = true;
        lastReleaseRef.current = null;
        finishQuestion(false);
        return;
      }
    }

    ignorePressRef.current = false;
    pressStartRef.current = now;
  }, [canInteract, gapTolerance, finishQuestion]);

  /**
   * Handle press UP (measure duration → classify as dot/dash).
   */
  const onPressOut = React.useCallback(() => {
    if (!canInteract) return;

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
  }, [canInteract, signalTolerance, appendSymbol, finishQuestion]);

  // Close (cleanup only; navigation handled inside SessionHeader)
  const handleCloseCleanup = React.useCallback(() => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
  }, []);

  // If lesson has no content, show graceful empty state
  if (!meta.pool.length) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Content unavailable.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // If finished, show the summary screen
  if (summary) {
    return (
      <SafeAreaView style={styles.safe}>
        <SessionSummary
          percent={summary.percent}
          correct={summary.correct}
          total={TOTAL_QUESTIONS}
          onContinue={handleCloseCleanup}
        />
      </SafeAreaView>
    );
  }

  // User input show (spaced) + color by feedback
  const inputSpaced = input.split('').join(' ');
  const inputColor =
    feedback === 'correct'
      ? colors.gold
      : feedback === 'wrong'
      ? '#FF6B6B'
      : colors.blueNeon;

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
        {/* TOP: header + progress */}
        <View style={styles.topGroup}>
          <SessionHeader
            labelTop={meta.headerTop}
            labelBottom="SEND"
            onClose={handleCloseCleanup}
          />
          <ProgressBar value={results.length} total={TOTAL_QUESTIONS} />
        </View>

        {/* CENTER: Prompt card only (moves based on screen height) */}
        <View style={styles.centerGroup}>
          <PromptCard
            compact
            revealSize="sm"
            title="Tap to key the Morse code"
            started={started}
            visibleChar={started ? (currentTarget ?? '') : ''}
            feedback={feedback}
            morse={currentMorse}
            showReveal={showReveal}
            canInteract={canInteract}
            onStart={startSession}
            onRevealToggle={() => setShowReveal((v) => !v)}
            onReplay={playTarget}
            mainSlotMinHeight={promptSlotHeight}
            belowReveal={
              <Text
                style={[
                  styles.inputInCard,
                  { color: inputColor, fontSize: inputFontSize },
                ]}
                numberOfLines={1}
                ellipsizeMode="clip"
              >
                {inputSpaced || ' '}
              </Text>
            }
          />
        </View>

        {/* BOTTOM: toggles above keyer; keyer pinned at very bottom */}
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

          {/* Classic keyer button (solid, bordered) */}
          <Pressable
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={!canInteract}
            style={({ pressed }) => [
              styles.keyer,
              { minHeight: keyerMinHeight },
              pressed && styles.keyerPressed,
              !canInteract && { opacity: 0.5 },
            ]}
          >
            <Text style={styles.keyerText}>Tap & Hold to Key</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

/**
 * Styles: pinned layout + classic solid buttons
 */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },

  container: {
    flex: 1,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
    paddingBottom: spacing(3),
  },

  // layout bands
  topGroup: { marginBottom: spacing(0) },
  centerGroup: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottomGroup: {},

  inputInCard: {
    letterSpacing: 6,
    fontWeight: '700',
  },

  // margin between toggles and keyer
  togglesWrap: {
    alignSelf: 'stretch',
    paddingHorizontal: spacing(2),
    marginBottom: spacing(3),
  },

  // Classic keyer button (reverted)
  keyer: {
    width: '100%',
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: '#0F151D',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(1.5),
    paddingHorizontal: spacing(2),
  },
  keyerPressed: { backgroundColor: '#15202A' },
  keyerText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.5,
  },

  // empty state
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
