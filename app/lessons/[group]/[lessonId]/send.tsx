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
import SessionHeader from '@/components/session/SessionHeader';
import ProgressBar from '@/components/session/ProgressBar';
import ActionButton from '@/components/session/ActionButton';
import OutputToggle from '@/components/session/OutputToggle';
import SessionSummary from '@/components/session/SessionSummary';
import { colors, spacing } from '@/theme/lessonTheme';
import { toMorse } from '@/utils/morse';
import { playMorseCode, getMorseUnitMs } from '@/utils/audio';
import { useProgressStore } from '@/store/useProgressStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { buildSessionMeta } from './sessionMeta';

const TOTAL_QUESTIONS = 20;

type Summary = { correct: number; percent: number };
type GapType = 'intra' | 'inter' | 'word';

function classifySignalDuration(
  durationMs: number,
  unitMs: number,
  tolerance: number,
): '.' | '-' | null {
  const options: Array<{ symbol: '.' | '-'; duration: number }> = [
    { symbol: '.', duration: unitMs },
    { symbol: '-', duration: unitMs * 3 },
  ];
  let best: { symbol: '.' | '-'; ratio: number } | null = null;
  options.forEach((opt) => {
    const ratio = Math.abs(durationMs - opt.duration) / opt.duration;
    if (!best || ratio < best.ratio) {
      best = { symbol: opt.symbol, ratio };
    }
  });
  if (best && best.ratio <= tolerance) return best.symbol;
  return null;
}

function classifyGapDuration(
  durationMs: number,
  unitMs: number,
  tolerance: number,
): GapType | null {
  const options: Array<{ type: GapType; duration: number }> = [
    { type: 'intra', duration: unitMs },
    { type: 'inter', duration: unitMs * 3 },
    { type: 'word', duration: unitMs * 7 },
  ];
  let best: { type: GapType; ratio: number } | null = null;
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
  const { group, lessonId } = useLocalSearchParams<{ group: string; lessonId: string }>();
  const router = useRouter();
  const homePath = '../../../../(tabs)/index';
  const meta = React.useMemo(() => buildSessionMeta(group || 'alphabet', lessonId), [group, lessonId]);
  const setScore = useProgressStore((s) => s.setScore);

  const {
    audioEnabled,
    lightEnabled,
    torchEnabled,
    hapticsEnabled,
    signalTolerancePercent,
    gapTolerancePercent,
    setAudioEnabled,
    setLightEnabled,
    setTorchEnabled,
    setHapticsEnabled,
  } = useSettingsStore();

  const signalTolerance = signalTolerancePercent / 100;
  const gapTolerance = gapTolerancePercent / 100;

  const [started, setStarted] = React.useState(false);
  const [questions, setQuestions] = React.useState<string[]>([]);
  const [results, setResults] = React.useState<boolean[]>([]);
  const [feedback, setFeedback] = React.useState<'idle' | 'correct' | 'wrong'>('idle');
  const [showReveal, setShowReveal] = React.useState(false);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [input, setInput] = React.useState('');

  const inputRef = React.useRef('');
  const updateInput = React.useCallback((next: string) => {
    inputRef.current = next;
    setInput(next);
  }, []);

  const flash = React.useRef(new Animated.Value(0)).current;
  const pressStartRef = React.useRef<number | null>(null);
  const lastReleaseRef = React.useRef<number | null>(null);
  const ignorePressRef = React.useRef(false);
  const advanceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentIndex = results.length;
  const currentTarget = questions[currentIndex] ?? null;
  const currentMorse = currentTarget ? toMorse(currentTarget) ?? '' : '';

  const percent = React.useMemo(() => {
    if (results.length === 0) return 0;
    const correct = results.filter(Boolean).length;
    return Math.round((correct / results.length) * 100);
  }, [results]);

  React.useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

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

  const hapticTick = React.useCallback(
    async (symbol: '.' | '-') => {
      if (!hapticsEnabled) return;
      try {
        const style = symbol === '.' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium;
        await Haptics.impactAsync(style);
      } catch {
        // Devices without haptic engines can ignore the error.
      }
    },
    [hapticsEnabled],
  );

  const playTarget = React.useCallback(async () => {
    if (!currentMorse) return;
    await playMorseCode(currentMorse, getMorseUnitMs(), {
      onSymbolStart: (symbol, duration) => {
        runFlash(duration);
        hapticTick(symbol);
      },
    });
  }, [currentMorse, runFlash, hapticTick]);

  const expectedRef = React.useRef(currentMorse);
  expectedRef.current = currentMorse;

  const finishQuestion = React.useCallback(
    (isCorrect: boolean) => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      setFeedback(isCorrect ? 'correct' : 'wrong');
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
            if (group && lessonId) {
              setScore(group, lessonId, 'send', pct);
            }
          }
          return next;
        });
        updateInput('');
        setShowReveal(false);
        setFeedback('idle');
      }, 450);
    },
    [group, lessonId, setScore, updateInput],
  );

  const appendSymbol = React.useCallback(
    (symbol: '.' | '-') => {
      if (!currentTarget) return;
      const expected = expectedRef.current;
      const next = `${inputRef.current}${symbol}`;
      updateInput(next);

      if (!expected.startsWith(next)) {
        finishQuestion(false);
        return;
      }
      if (expected === next) {
        finishQuestion(true);
      }
    },
    [currentTarget, finishQuestion, updateInput],
  );

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
    pressStartRef.current = null;
    lastReleaseRef.current = null;
    ignorePressRef.current = false;
  }, [meta.pool, updateInput]);

  const canInteract = started && !summary && !!currentTarget && feedback === 'idle';

  const onPressIn = React.useCallback(() => {
    if (!started || summary || !currentTarget || feedback !== 'idle') return;

    const now = Date.now();
    if (inputRef.current.length > 0 && lastReleaseRef.current !== null) {
      const gapDuration = now - lastReleaseRef.current;
      const gapType = classifyGapDuration(gapDuration, getMorseUnitMs(), gapTolerance);
      if (gapType !== 'intra') {
        ignorePressRef.current = true;
        lastReleaseRef.current = null;
        finishQuestion(false);
        return;
      }
    }

    ignorePressRef.current = false;
    pressStartRef.current = now;
  }, [started, summary, currentTarget, feedback, gapTolerance, finishQuestion]);

  const onPressOut = React.useCallback(() => {
    if (!started || !currentTarget || summary || feedback !== 'idle') return;

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
    const symbol = classifySignalDuration(duration, getMorseUnitMs(), signalTolerance);
    if (!symbol) {
      lastReleaseRef.current = null;
      finishQuestion(false);
      return;
    }

    lastReleaseRef.current = releaseAt;
    appendSymbol(symbol);
  }, [started, currentTarget, summary, feedback, signalTolerance, appendSymbol, finishQuestion]);

  const promptText = started ? 'Tap to key the Morse code' : 'Press start to begin';

  const handleClose = React.useCallback(() => {
    router.replace(homePath);
  }, [router]);

  const handleReveal = React.useCallback(() => {
    if (!canInteract) return;
    setShowReveal((prev) => !prev);
  }, [canInteract]);

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

  return (
    <SafeAreaView style={styles.safe}>
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
        <SessionHeader
          labelTop={meta.headerTop}
          labelBottom="SEND"
          onClose={handleClose}
        />

        <ProgressBar value={results.length} total={TOTAL_QUESTIONS} />

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
                styles.letter,
                feedback === 'correct' && { color: colors.gold },
                feedback === 'wrong' && { color: '#FF6B6B' },
              ]}
            >
              {currentTarget}
            </Text>
          )}
        </View>
        <Text style={styles.promptHint}>{promptText}</Text>
        {showReveal && canInteract && (
          <Text style={styles.reveal}>{currentMorse.split('').join(' ')}</Text>
        )}

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
            {started && <Text style={styles.input}>{inputRef.current.split('').join(' ')}</Text>}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

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
