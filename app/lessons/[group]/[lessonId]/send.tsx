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
 *
 * UPDATE: Outputs tied to keyer
 * - On press-in: audio tone + continuous haptic (Android) / repeated taps (iOS) + held screen flash
 * - On release: stop audio + cancel haptic + fade flash off
 * - Auto-play per question removed
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
import { getMorseUnitMs } from '@/utils/audio';

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

/** --- Tone generation helpers for keyer (local & looping) --- */
function bytesToBase64(bytes: Uint8Array): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i] ?? 0;
    const b2 = bytes[i + 1];
    const b3 = bytes[i + 2];
    const enc1 = b1 >> 2;
    const enc2 = ((b1 & 3) << 4) | ((b2 ?? 0) >> 4);
    const enc3 = b2 !== undefined ? (((b2 & 15) << 2) | ((b3 ?? 0) >> 6)) : 64;
    const enc4 = b3 !== undefined ? (b3 & 63) : 64;
    output +=
      chars.charAt(enc1) +
      chars.charAt(enc2) +
      chars.charAt(enc3) +
      chars.charAt(enc4);
  }
  return output;
}

/** Generate a loop-safe sine WAV: we quantize to an integer number of cycles to minimize click at loop boundary. */
function generateLoopingSineWav(
  frequency: number,
  opts?: { sampleRate?: number; cycles?: number; amplitude?: number },
): Uint8Array {
  const sampleRate = opts?.sampleRate ?? 44100;
  const cycles = opts?.cycles ?? 200; // more cycles = longer buffer, smoother loop
  const amplitude = Math.max(0, Math.min(1, opts?.amplitude ?? 0.28));

  // Quantize period to integer samples so end phase == start phase
  const periodSamples = Math.max(1, Math.round(sampleRate / frequency));
  const totalSamples = periodSamples * cycles;

  const bytesPerSample = 2;
  const dataSize = totalSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  // WAV header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // PCM samples (with tiny fade-in/out to avoid transient click)
  let offset = 44;
  const ramp = Math.min(64, Math.floor(totalSamples * 0.01));
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const s = Math.sin(2 * Math.PI * frequency * t);
    const env =
      i < ramp ? i / ramp :
      i > totalSamples - ramp ? (totalSamples - i) / ramp : 1;
    const val = (Math.max(-1, Math.min(1, s)) * amplitude * env * 32767) | 0;
    view.setInt16(offset, val, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
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
    toneHz,
  } = settings;

  const signalTolerancePercent =
    typeof settings.signalTolerancePercent === 'number'
      ? settings.signalTolerancePercent
      : 30; // +/-30%
  const gapTolerancePercent =
    typeof settings.gapTolerancePercent === 'number'
      ? settings.gapTolerancePercent
      : 50; // +/-50%

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
  const [streak, setStreak] = React.useState(0);
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

  const currentMorseRef = React.useRef('');

  // Audio tone for keyer
  const keyerSoundRef = React.useRef<Audio.Sound | null>(null);
  const currentToneHzRef = React.useRef<number | null>(null);
  const hapticIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Current question: target char + its Morse pattern
  const currentIndex = results.length;
  const currentTarget = questions[currentIndex] ?? null;
  const currentMorse = currentTarget ? (toMorse(currentTarget) ?? '') : '';
  currentMorseRef.current = currentMorse;

  // Responsive tuning for compact UI
  const screenH = Dimensions.get('window').height;
  const layout = screenH < 635 ? 'xsmall' : screenH < 700 ? 'small' : 'regular';
  const promptSlotHeight =
    layout === 'regular' ? 116 : layout === 'small' ? 96 : 84;
  const keyerMinHeight =
    layout === 'regular' ? 128 : layout === 'small' ? 104 : 92;
  const inputFontSize =
    layout === 'regular' ? 20 : layout === 'small' ? 18 : 16;

  // Cleanup timer & audio on unmount
  React.useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      // Cleanup audio
      (async () => {
        try {
          await keyerSoundRef.current?.unloadAsync();
        } catch {}
      })();
      // Cleanup haptic timer
      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current);
        hapticIntervalRef.current = null;
      }
      // Ensure vibration off
      try { Vibration.cancel(); } catch {}
    };
  }, []);

  /** Configure audio mode for silent-mode playback (best-effort). */
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

  /** Prepare (or re-prepare) a loop-safe tone sound for the keyer. */
  const prepareKeyerTone = React.useCallback(async (hz: number) => {
    if (currentToneHzRef.current === hz && keyerSoundRef.current) return;

    // unload old
    try { await keyerSoundRef.current?.unloadAsync(); } catch {}
    keyerSoundRef.current = null;

    await ensureAudioMode();

    const wavBytes = generateLoopingSineWav(hz, { cycles: 300 }); // ~longer buffer -> smoother loop
    const b64 = bytesToBase64(wavBytes);
    const dir = FileSystem.cacheDirectory + 'morse-keyer/';
    try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true } as any); } catch {}
    const uri = `${dir}keyer_${hz}.wav`;
    await FileSystem.writeAsStringAsync(uri, b64, { encoding: 'base64' as any });

    const created = await Audio.Sound.createAsync({ uri });
    keyerSoundRef.current = created.sound;
    currentToneHzRef.current = hz;
    try { await keyerSoundRef.current.setIsLoopingAsync(true); } catch {}
  }, [ensureAudioMode]);

  /** Flash controls: ON immediately, OFF with quick fade. */
  const flashOn = React.useCallback(() => {
    if (!lightEnabled) return;
    try { flash.stopAnimation(); } catch {}
    flash.setValue(1);
  }, [lightEnabled, flash]);

  const flashOff = React.useCallback(() => {
    // short fade to avoid abrupt cut
    Animated.timing(flash, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start();
  }, [flash]);

  /** Haptics controls */
  const startHaptics = React.useCallback(() => {
    if (!hapticsEnabled) return;

    if (Platform.OS === 'android') {
      // Continuous vibration via repeating pattern; will be canceled on release
      try {
        Vibration.vibrate([0, 40, 60], true);
      } catch {}
    } else {
      // iOS: no continuous vibration; simulate periodic taps while held
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
      if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = setInterval(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }, 120);
    }
  }, [hapticsEnabled]);

  const stopHaptics = React.useCallback(() => {
    if (Platform.OS === 'android') {
      try { Vibration.cancel(); } catch {}
    } else {
      if (hapticIntervalRef.current) {
        clearInterval(hapticIntervalRef.current);
        hapticIntervalRef.current = null;
      }
    }
  }, []);

  /** Audio tone controls */
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

  /**
   * Visual flash feedback was previously symbol-length-based; for keyer hold we keep it fully on
   * during press and fade it off on release.
   */

  /**
   * PlayTarget: keep API for PromptCard replay, but now NO-OP so we don't play for each question.
   * (If you want the replay button to still play the target pattern, you can reintroduce
   * playMorseCode here using your synced version.)
   */
  const playTarget = React.useCallback(async () => {
    // no-op per request (outputs tied to keyer only)
    return;
  }, []);

  /**
   * Finish current question and advance.
   */
  const setScoreStore = setScore;
  const finishQuestion = React.useCallback(
    (isCorrect: boolean) => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      setFeedback(isCorrect ? 'correct' : 'wrong');
      setStreak((prev) => (isCorrect ? prev + 1 : 0));
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
            if (group && lessonId) setScoreStore(group, lessonId, 'send', pct);
          }
          return next;
        });

        // reset per-question UI
        updateInput('');
        setShowReveal(false);
        setFeedback('idle');
      }, 650);
    },
    [group, lessonId, setScoreStore, updateInput],
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
        // diverged -> wrong
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
    setStreak(0);
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
   * Handle press DOWN:
   * - validate previous gap
   * - start outputs (audio / haptic / flash)
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
        // Wrong gap -> mark wrong and ignore this press
        ignorePressRef.current = true;
        lastReleaseRef.current = null;
        finishQuestion(false);
        return;
      }
    }

    ignorePressRef.current = false;
    pressStartRef.current = now;

    // --- START OUTPUTS ---
    flashOn();
    startHaptics();
    startTone().catch(() => {});
  }, [canInteract, gapTolerance, finishQuestion, flashOn, startHaptics, startTone]);

  /**
   * Handle press UP:
   * - stop outputs
   * - measure duration -> classify '.' or '-' -> evaluate
   */
  const onPressOut = React.useCallback(() => {
    if (!canInteract) return;

    // --- STOP OUTPUTS ---
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
  }, [canInteract, signalTolerance, appendSymbol, finishQuestion, flashOff, stopHaptics, stopTone]);

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
      {/* Full-screen overlay we animate to produce a held flash */}
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
          <ProgressBar
            value={results.length}
            total={TOTAL_QUESTIONS}
            streak={streak}
          />
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
            onReplay={playTarget} // kept for UI; currently a no-op
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
    paddingHorizontal: spacing(2.5),
    marginBottom: spacing(2.75),
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
