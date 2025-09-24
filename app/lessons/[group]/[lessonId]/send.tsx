/**
 * SEND SESSION SCREEN (Pinned layout)
 * -----------------------------------
 * Outputs tied directly to the keyer:
 * - Press-in: start continuous tone + screen held ON + continuous vibration (Android) / rapid taps (iOS)
 * - Press-out: stop tone + fade flash OFF + cancel/cooldown haptics
 *
 * Visuals:
 * - While answering: show ONLY the user's input timeline (1/4-unit granularity), gaps invisible.
 * - On Reveal or after CORRECT answer: show compare view (target row + user row).
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
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

// Shared UI
import SessionHeader from '@/components/session/SessionHeader';
import ProgressBar from '@/components/session/ProgressBar';
import SessionSummary from '@/components/session/SessionSummary';
import PromptCard from '@/components/session/PromptCard';
import OutputTogglesRow from '@/components/session/OutputTogglesRow';
import RevealBar from '@/components/session/RevealBar';
import { MorseTimeline } from '@/components/MorseViz';

// Theme + utils
import { colors, spacing } from '@/theme/lessonTheme';
import { theme } from '@/theme/theme';
import { toMorse } from '@/utils/morse';
import { getMorseUnitMs } from '@/utils/audio';

// Stores
import { useProgressStore } from '@/store/useProgressStore';
import { useSettingsStore } from '@/store/useSettingsStore';

// Lesson meta
import { buildSessionMeta } from './sessionMeta';

const TOTAL_QUESTIONS = 20;

type Summary = { correct: number; percent: number };
type GapType = 'intra' | 'inter' | 'word';

function classifySignalDuration(
  durationMs: number,
  unitMs: number,
  tolerance: number,
): '.' | '-' | null {
  if (durationMs <= 0) return null;

  const clampedTol = Math.max(0.05, Math.min(tolerance, 0.9));
  const dotUpper = unitMs * (1 + clampedTol);
  if (durationMs <= dotUpper) return '.';

  const dashTarget = unitMs * 3;
  const dashLower = dashTarget * (1 - clampedTol);
  const dashUpper = dashTarget * (1 + clampedTol);
  if (durationMs >= dashLower && durationMs <= dashUpper) return '-';

  return null;
}

function classifyGapDuration(
  durationMs: number,
  unitMs: number,
  tolerance: number,
): GapType | null {
  const targets: Array<{ type: GapType; duration: number }> = [
    { type: 'intra', duration: unitMs },
    { type: 'inter', duration: unitMs * 3 },
    { type: 'word', duration: unitMs * 7 },
  ];
  let best: { type: GapType; ratio: number } | undefined;
  for (const t of targets) {
    const ratio = Math.abs(durationMs - t.duration) / t.duration;
    if (!best || ratio < best.ratio) best = { type: t.type, ratio };
  }
  return best && best.ratio <= tolerance ? best.type : null;
}

/** ---------- Loop-safe tone for keyer (no boundary clicks) ---------- */
function bytesToBase64(bytes: Uint8Array): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i] ?? 0;
    const b2 = bytes[i + 1];
    const b3 = bytes[i + 2];
    const e1 = b1 >> 2;
    const e2 = ((b1 & 3) << 4) | ((b2 ?? 0) >> 4);
    const e3 = b2 !== undefined ? (((b2 & 15) << 2) | ((b3 ?? 0) >> 6)) : 64;
    const e4 = b3 !== undefined ? (b3 & 63) : 64;
    out +=
      chars.charAt(e1) +
      chars.charAt(e2) +
      chars.charAt(e3) +
      chars.charAt(e4);
  }
  return out;
}

/**
 * Generate a sine buffer with:
 * - integer number of periods (end phase == start phase)
 * - tiny fade-in only (no fade-out at loop point) to avoid boundary pulsing
 */
function generateLoopingSineWav(
  frequency: number,
  opts?: { sampleRate?: number; cycles?: number; amplitude?: number },
): Uint8Array {
  const sampleRate = opts?.sampleRate ?? 44100;
  const amplitude = Math.max(0, Math.min(1, opts?.amplitude ?? 0.28));

  // Quantize period to integer samples for perfect phase at the loop point.
  const periodSamples = Math.max(1, Math.round(sampleRate / frequency));
  const cycles = opts?.cycles ?? 2000; // longer buffer = fewer loop events
  const totalSamples = periodSamples * cycles;

  const bytesPerSample = 2; // 16-bit mono
  const dataSize = totalSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };

  // WAV header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Samples: fade-in only to prevent start click.
  let offset = 44;
  const rampIn = Math.min(128, Math.floor(totalSamples * 0.002)); // ~3ms @44.1k
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const s = Math.sin(2 * Math.PI * (sampleRate / periodSamples) * t);
    const env = i < rampIn ? i / rampIn : 1; // fade-in only
    const val = (Math.max(-1, Math.min(1, s)) * amplitude * env * 32767) | 0;
    view.setInt16(offset, val, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

export default function SendSessionScreen() {
  const { group, lessonId } = useLocalSearchParams<{
    group: string;
    lessonId: string;
  }>();
  const meta = React.useMemo(
    () => buildSessionMeta(group || 'alphabet', lessonId),
    [group, lessonId],
  );

  const setScore = useProgressStore((s) => s.setScore);

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
    toneHz,
  } = settings;

  const signalTolerancePercent =
    typeof settings.signalTolerancePercent === 'number'
      ? settings.signalTolerancePercent
      : 30;
  const gapTolerancePercent =
    typeof settings.gapTolerancePercent === 'number'
      ? settings.gapTolerancePercent
      : 50;

  const signalTolerance = signalTolerancePercent / 100;
  const gapTolerance = gapTolerancePercent / 100;

  const [started, setStarted] = React.useState(false);
  const [questions, setQuestions] = React.useState<string[]>([]);
  const [results, setResults] = React.useState<boolean[]>([]);
  const [feedback, setFeedback] = React.useState<'idle' | 'correct' | 'wrong'>(
    'idle',
  );
  const [showReveal, setShowReveal] = React.useState(false);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [streak, setStreak] = React.useState(0);
  const [input, setInput] = React.useState('');

  // Capture exact press windows for visualization
  const [presses, setPresses] = React.useState<{ startMs: number; endMs: number }[]>([]);

  const inputRef = React.useRef('');
  const updateInput = React.useCallback((next: string) => {
    inputRef.current = next;
    setInput(next);
  }, []);

  const flash = React.useRef(new Animated.Value(0)).current;

  const pressStartRef = React.useRef<number | null>(null);
  const lastReleaseRef = React.useRef<number | null>(null);
  const ignorePressRef = React.useRef(false);
  const advanceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const currentMorseRef = React.useRef('');

  // Keyer audio + iOS haptic loop handle
  const keyerSoundRef = React.useRef<Audio.Sound | null>(null);
  const currentToneHzRef = React.useRef<number | null>(null);
  const hapticIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const currentIndex = results.length;
  const currentTarget = questions[currentIndex] ?? null;
  const currentMorse = currentTarget ? (toMorse(currentTarget) ?? '') : '';
  currentMorseRef.current = currentMorse;

  const screenH = Dimensions.get('window').height;
  const layout = screenH < 635 ? 'xsmall' : screenH < 700 ? 'small' : 'regular';
  const promptSlotHeight =
    layout === 'regular' ? 116 : layout === 'small' ? 96 : 84;
  const keyerMinHeight =
    layout === 'regular' ? 128 : layout === 'small' ? 104 : 92;

  React.useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      (async () => {
        try {
          await keyerSoundRef.current?.unloadAsync();
        } catch {}
      })();
      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current);
        hapticIntervalRef.current = null;
      }
      try {
        Vibration.cancel();
      } catch {}
    };
  }, []);

  /** Best-effort audio mode for silent-mode playback */
  const ensureAudioMode = React.useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });
    } catch {}
  }, []);

  /** Prepare long, loop-perfect tone (no boundary clicks) */
  const prepareKeyerTone = React.useCallback(
    async (hz: number) => {
      if (currentToneHzRef.current === hz && keyerSoundRef.current) return;

      try {
        await keyerSoundRef.current?.unloadAsync();
      } catch {}
      keyerSoundRef.current = null;

      await ensureAudioMode();

      const wav = generateLoopingSineWav(hz, { cycles: 2000, amplitude: 0.28 });
      const b64 = bytesToBase64(wav);
      const dir = FileSystem.cacheDirectory + 'morse-keyer/';
      try {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true } as any);
      } catch {}
      const uri = `${dir}keyer_${hz}.wav`;
      await FileSystem.writeAsStringAsync(uri, b64, { encoding: 'base64' as any });

      const created = await Audio.Sound.createAsync({ uri });
      keyerSoundRef.current = created.sound;
      currentToneHzRef.current = hz;
      try {
        await keyerSoundRef.current.setIsLoopingAsync(true);
      } catch {}
    },
    [ensureAudioMode],
  );

  /** FLASH: press-in -> go to 1 IMMEDIATELY (native), release -> fade to 0 */
  const flashOn = React.useCallback(() => {
    if (!lightEnabled) return;
    try {
      flash.stopAnimation();
    } catch {}
    Animated.timing(flash, {
      toValue: 1,
      duration: 0,
      useNativeDriver: true,
    }).start();
  }, [lightEnabled, flash]);

  const flashOff = React.useCallback(() => {
    Animated.timing(flash, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start();
  }, [flash]);

  /** HAPTICS: Android -> continuous single vibrate; iOS -> rapid impacts (platform limit) */
  const startHaptics = React.useCallback(() => {
    if (!hapticsEnabled) return;

    if (Platform.OS === 'android') {
      try {
        // Long single vibrate; cancel on release
        Vibration.vibrate(120000);
      } catch {}
    } else {
      // iOS cannot vibrate continuously; simulate with rapid taps
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
      if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = setInterval(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }, 80);
    }
  }, [hapticsEnabled]);

  const stopHaptics = React.useCallback(() => {
    if (Platform.OS === 'android') {
      try {
        Vibration.cancel();
      } catch {}
    } else {
      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current);
        hapticIntervalRef.current = null;
      }
    }
  }, []);

  /** AUDIO: start/stop continuous tone tied to keyer */
  const startTone = React.useCallback(async () => {
    if (!audioEnabled) return;
    const hz = Number(toneHz) || 600;
    await prepareKeyerTone(hz);
    try {
      await keyerSoundRef.current?.setPositionAsync(0);
      keyerSoundRef.current?.playAsync().catch(() => {});
    } catch {}
  }, [audioEnabled, toneHz, prepareKeyerTone]);

  const stopTone = React.useCallback(async () => {
    try {
      await keyerSoundRef.current?.stopAsync();
      await keyerSoundRef.current?.setPositionAsync(0);
    } catch {}
  }, []);

  /** Session flow */
  const setScoreStore = setScore;

  const finishQuestion = React.useCallback(
    (isCorrect: boolean) => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      setFeedback(isCorrect ? 'correct' : 'wrong');
      setStreak((prev) => (isCorrect ? prev + 1 : 0));

      // Only auto-reveal the canonical when the user keyed it correctly
      if (isCorrect) setShowReveal(true);

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
            if (group && lessonId) setScoreStore(group, lessonId, 'send', pct);
          }
          return next;
        });

        updateInput('');
        setPresses([]); // clear visualization for the next question
        setShowReveal(false);
        setFeedback('idle');
      }, 650);
    },
    [group, lessonId, setScoreStore, updateInput],
  );

  const appendSymbol = React.useCallback(
    (symbol: '.' | '-') => {
      if (!currentTarget) return;

      const expected = currentMorse;
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
    [currentTarget, currentMorse, finishQuestion, updateInput],
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
    setPresses([]);
    setShowReveal(false);
    setFeedback('idle');
    setSummary(null);
    setStreak(0);
    setStarted(true);

    pressStartRef.current = null;
    lastReleaseRef.current = null;
    ignorePressRef.current = false;
  }, [meta.pool, updateInput]);

  const canInteract =
    started && !summary && !!currentTarget && feedback === 'idle';

  /** Press DOWN: validate gap, then turn outputs ON */
  const onPressIn = React.useCallback(() => {
    if (!canInteract) return;

    const now = Date.now();

    // Validate gap since last release (must be intra-character)
    if (inputRef.current.length > 0 && lastReleaseRef.current !== null) {
      const gapDuration = now - lastReleaseRef.current;
      const gapType = classifyGapDuration(
        gapDuration,
        getMorseUnitMs(),
        gapTolerance,
      );
      if (gapType !== 'intra') {
        ignorePressRef.current = true;
        lastReleaseRef.current = null;
        finishQuestion(false);
        return;
      }
    }

    ignorePressRef.current = false;
    pressStartRef.current = now;

    // OUTPUTS ON
    flashOn();
    startHaptics();
    startTone().catch(() => {});
  }, [canInteract, gapTolerance, finishQuestion, flashOn, startHaptics, startTone]);

  /** Press UP: turn outputs OFF, then classify duration & record press window */
  const onPressOut = React.useCallback(() => {
    if (!canInteract) return;

    // OUTPUTS OFF
    flashOff();
    stopHaptics();
    stopTone().catch(() => {});

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

    // record the exact press window for visualization
    setPresses((prev) => [...prev, { startMs: startAt, endMs: releaseAt }]);

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

    lastReleaseRef.current = releaseAt;
    appendSymbol(symbol);
  }, [canInteract, signalTolerance, appendSymbol, finishQuestion, flashOff, stopHaptics, stopTone]);

  const handleCloseCleanup = React.useCallback(() => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
  }, []);

  // Empty state
  if (!meta.pool.length) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Content unavailable.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Summary
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

  // Compute WPM from your unitMs helper so visualization matches the timing engine
  const unitMs = getMorseUnitMs();
  const wpm = unitMs > 0 ? 1200 / unitMs : 12;

  // Choose bottom bar color: red when wrong, gold otherwise (for compare view)
  const bottomBarColor = feedback === 'wrong' ? '#FF6B6B' : colors.gold;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Held flash: opacity stays high while pressed, then fades off on release */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: colors.text,
            opacity: flash.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.28],
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
          <ProgressBar
            value={results.length}
            total={TOTAL_QUESTIONS}
            streak={streak}
          />
        </View>

        {/* CENTER: Prompt card only */}
        <View style={styles.centerGroup}>
          <PromptCard
            compact
            revealSize="sm"
            title="Tap to key the Morse code"
            started={started}
            visibleChar={started ? (currentTarget ?? '') : ''}
            feedback={feedback}
            morse={''}                        // <- disable old text reveal to avoid duplicates
            showReveal={showReveal}
            canInteract={canInteract}
            onStart={startSession}
            onRevealToggle={() => setShowReveal((v) => !v)}
            onReplay={() => { /* no-op: outputs are keyer-tied now */ }}
            mainSlotMinHeight={promptSlotHeight}
            belowReveal={
              <View style={{ alignSelf: 'stretch', alignItems: 'center' }}>
                {/* If revealed OR user got it correct, show compare (target + user). Otherwise show user-only live timeline. */}
                {(showReveal || feedback === 'correct') ? (
                  <RevealBar
                    mode="compare"
                    char={currentTarget ?? undefined}
                    presses={presses}
                    visible={true}
                    size="md"
                    wpm={wpm}
                    unitPx={12}
                    showLegend={false}
                    topColor={colors.blueNeon}
                    bottomColor={bottomBarColor}   // red when wrong (only visible if revealed)
                    align="center"
                  />
                ) : (
                  <MorseTimeline
                    // user-only live row (presses), 1/4-unit granularity, gaps invisible
                    source={{ mode: 'presses', presses, wpm, granularity: 4 }}
                    unitPx={12}
                    height={12}
                    color={colors.gold}
                    inactiveColor="transparent"
                    showGaps={false}
                    rounded
                    style={{ alignSelf: 'center' }}
                  />
                )}
              </View>
            }
          />
        </View>

        {/* BOTTOM: toggles + keyer */}
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

/** Styles (unchanged UI) */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },

  container: {
    flex: 1,
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
    paddingBottom: spacing(3),
  },

  topGroup: { marginBottom: spacing(0) },
  centerGroup: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottomGroup: {},

  togglesWrap: {
    alignSelf: 'stretch',
    paddingHorizontal: spacing(2.5),
    marginBottom: spacing(2.75),
  },

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
