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
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../../../../theme/theme';
import { colors as lessonColors } from '../../../../theme/lessonTheme';
import { getLesson, getGroupById } from '../../../../data/lessons';
import { toMorse } from '../../../../utils/morse';
import { playMorseCode, getMorseUnitMs } from '../../../../utils/audio';
import { useProgressStore } from '../../../../store/useProgressStore';
import { useSettingsStore } from '../../../../store/useSettingsStore';

const TOTAL_QUESTIONS = 20;
const QUESTION_TIME_LIMIT_MS = 1000;

type Result = {
  target: string;
  expected: string;
  user: string;
  correct: boolean;
  reason: 'exact' | 'error' | 'timeout';
};

const SYMBOL_MAP: Record<string, string> = { '.': 'Ã¢â‚¬Â¢', '-': 'Ã¢â‚¬â€' };

function prettify(code: string) {
  return code
    .split('')
    .map((c) => SYMBOL_MAP[c] ?? c)
    .join(' ');
}

function formatSubtitle(chars: string[]) {
  if (!chars.length) return '';
  if (chars.length <= 6) return chars.join(' Ã¢â‚¬Â¢ ');
  const sample = chars.slice(0, 6).join(' Ã¢â‚¬Â¢ ');
  return `${sample} Ã¢â‚¬Â¦`;
}

type SquareButtonProps = {
  active?: boolean;
  variant?: 'primary' | 'toggle';
  label: string;
  onPress: () => void;
  children: React.ReactNode;
};

function SquareButton({ active, variant = 'primary', label, onPress, children }: SquareButtonProps) {
  const base = [styles.squareBase];
  if (variant === 'primary') base.push(styles.squarePrimary);
  else base.push(styles.squareToggle);
  if (active) base.push(styles.squareActive);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ pressed: !!active }}
      onPress={onPress}
      style={({ pressed }) => [base, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

function LessonProgressBar({ ratio }: { ratio: number }) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <View style={styles.progressTrack}>
      {clamped > 0 && (
        <View style={[styles.progressFillWrap, { width: `${clamped * 100}%` }]}>
          <ExpoLinearGradient
            colors={['#00E5FF', '#0077FF']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.progressFill}
          />
        </View>
      )}
    </View>
  );
}

function SummaryView({
  percent,
  correct,
  onRetry,
  onDone,
}: {
  percent: number;
  correct: number;
  onRetry: () => void;
  onDone: () => void;
}) {
  const strokeGradient =
    percent > 90 ? 'ringGold' : percent > 70 ? 'ringBlue' : 'ringRed';
  const textColor =
    percent > 90
      ? '#FFD700'
      : percent > 70
      ? theme.colors.accent
      : theme.colors.error;
  const size = 220;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * (1 - Math.max(0, Math.min(percent, 100)) / 100);

  return (
    <View style={styles.summaryWrap}>
      <Text style={styles.summaryTitle}>Session Complete</Text>
      <View style={styles.ringWrap}>
        <Svg width={size} height={size}>
          <Defs>
            <SvgLinearGradient id="ringBlue" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#00E5FF" />
              <Stop offset="100%" stopColor="#0066FF" />
            </SvgLinearGradient>
            <SvgLinearGradient id="ringGold" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#FFD700" />
              <Stop offset="100%" stopColor="#FFB347" />
            </SvgLinearGradient>
            <SvgLinearGradient id="ringRed" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#FF5F6D" />
              <Stop offset="100%" stopColor="#FFC371" />
            </SvgLinearGradient>
          </Defs>
          <Circle
            stroke="#1F2A2F"
            fill="transparent"
            strokeWidth={strokeWidth}
            cx={size / 2}
            cy={size / 2}
            r={radius}
          />
          <Circle
            stroke={`url(#${strokeGradient})`}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dash}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={styles.ringCenter}>
          <Text style={[styles.summaryPercent, { color: textColor }]}>
            {percent}%
          </Text>
          <Text style={styles.summarySub}>{correct} / {TOTAL_QUESTIONS} correct</Text>
        </View>
      </View>
      <View style={styles.summaryActions}>
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [styles.summaryBtn, pressed && styles.pressed]}
        >
          <Text style={styles.summaryBtnText}>Retry Lesson</Text>
        </Pressable>
        <Pressable
          onPress={onDone}
          style={({ pressed }) => [styles.summaryBtnGhost, pressed && styles.pressed]}
        >
          <Text style={styles.summaryBtnGhostText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function SendLessonScreen() {
  const { group, lessonId } = useLocalSearchParams<{
    group: string;
    lessonId: string;
  }>();
  const router = useRouter();
  const groupObj = getGroupById(group || 'alphabet');
  const lesson = getLesson(group || 'alphabet', lessonId || '');
  const isChallenge = Boolean(lessonId && lessonId.startsWith('ch-'));
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

  const charPool = React.useMemo(() => {
    if (lesson && !isChallenge) return lesson.chars;
    if (!groupObj || !lessonId) return [];
    const idx = Number.parseInt(lessonId.replace('ch-', ''), 10);
    if (Number.isNaN(idx)) return [];
    const slice = groupObj.lessons.slice(0, Math.min(groupObj.lessons.length, idx * 2));
    const unique = Array.from(new Set(slice.flatMap((l) => l.chars)));
    return unique;
  }, [groupObj, lesson, isChallenge, lessonId]);

  const [questions, setQuestions] = React.useState<string[]>([]);
  const [index, setIndex] = React.useState(0);
  const [results, setResults] = React.useState<Result[]>([]);
  const [status, setStatus] = React.useState<'idle' | 'correct' | 'wrong'>('idle');
  const statusRef = React.useRef<'idle' | 'correct' | 'wrong'>('idle');
  const [feedback, setFeedback] = React.useState<{
    expected: string;
    user: string;
    correct: boolean;
    reason: Result['reason'];
  } | null>(null);
  const [showHelp, setShowHelp] = React.useState(false);
  const [summary, setSummary] = React.useState<{ percent: number; correct: number } | null>(null);

  const [, setUserCodeState] = React.useState('');
  const userCodeRef = React.useRef('');
  const updateUserCode = React.useCallback((code: string) => {
    userCodeRef.current = code;
    setUserCodeState(code);
  }, []);

  const pressStartRef = React.useRef<number | null>(null);
  const deadlineRef = React.useRef<number | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = React.useRef(new Animated.Value(0)).current;

  const clearDeadline = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    deadlineRef.current = null;
  }, []);

  const clearAdvance = React.useCallback(() => {
    if (advanceRef.current) {
      clearTimeout(advanceRef.current);
      advanceRef.current = null;
    }
  }, []);

  const startSession = React.useCallback(() => {
    if (!charPool.length) return;
    const next = Array.from({ length: TOTAL_QUESTIONS }, () => {
      const pick = charPool[Math.floor(Math.random() * charPool.length)];
      return pick;
    });
    clearDeadline();
    clearAdvance();
    setQuestions(next);
    setIndex(0);
    setResults([]);
    setSummary(null);
    setFeedback(null);
    updateUserCode('');
    setShowHelp(false);
    statusRef.current = 'idle';
    setStatus('idle');
  }, [charPool, clearAdvance, clearDeadline, updateUserCode]);

  React.useEffect(() => {
    startSession();
  }, [startSession]);

  React.useEffect(() => {
    return () => {
      clearDeadline();
      clearAdvance();
    };
  }, [clearAdvance, clearDeadline]);

  const target = questions[index] ?? null;
  const expected = React.useMemo(() => (target ? toMorse(target) ?? '' : ''), [target]);

  const correctCount = React.useMemo(
    () => results.filter((r) => r.correct).length,
    [results],
  );
  const progressRatio = summary
    ? summary.correct / TOTAL_QUESTIONS
    : correctCount / TOTAL_QUESTIONS;

  const pulseFlash = React.useCallback((durationMs: number) => {
    if (!lightEnabled) return;
    flash.setValue(0);
    Animated.sequence([
      Animated.timing(flash, {
        toValue: 0.9,
        duration: Math.min(80, durationMs / 3),
        useNativeDriver: true,
      }),
      Animated.timing(flash, {
        toValue: 0,
        duration: Math.max(80, durationMs / 2),
        useNativeDriver: true,
      }),
    ]).start();
  }, [flash, lightEnabled]);

  const finishQuestion = React.useCallback(
    (correct: boolean, finalCode: string, reason: Result['reason']) => {
      if (!target || !expected) return;
      if (statusRef.current !== 'idle') return;
      clearDeadline();
      statusRef.current = correct ? 'correct' : 'wrong';
      setStatus(correct ? 'correct' : 'wrong');
      setFeedback({ expected, user: finalCode, correct, reason });

      setResults((prev) => {
        const next = [
          ...prev,
          { target, expected, user: finalCode, correct, reason },
        ];
        const nextIndex = next.length;
        const nextCorrect = next.filter((r) => r.correct).length;
        clearAdvance();
        advanceRef.current = setTimeout(() => {
          if (nextIndex >= TOTAL_QUESTIONS) {
            const percent = Math.round((nextCorrect / TOTAL_QUESTIONS) * 100);
            setSummary({ percent, correct: nextCorrect });
            setScore(group || 'alphabet', lessonId || '', 'send', percent);
          } else {
            setIndex(nextIndex);
            statusRef.current = 'idle';
            setStatus('idle');
            setFeedback(null);
            updateUserCode('');
          }
        }, 1100);
        return next;
      });
    },
    [clearDeadline, clearAdvance, expected, group, lessonId, setScore, target, updateUserCode],
  );

  const handleTimeout = React.useCallback(() => {
    if (statusRef.current !== 'idle') return;
    finishQuestion(false, userCodeRef.current, 'timeout');
    if (hapticsEnabled) {
      (async () => {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch {}
      })();
    }
  }, [finishQuestion, hapticsEnabled]);

  const classifyDuration = React.useCallback((ms: number) => {
    const unit = getMorseUnitMs();
    const dotMax = unit * 1.6;
    return ms <= dotMax ? '.' : '-';
  }, []);

  const onPressIn = React.useCallback(async () => {
    if (!target || statusRef.current !== 'idle') return;
    pressStartRef.current = Date.now();
    if (!deadlineRef.current) {
      const expires = Date.now() + QUESTION_TIME_LIMIT_MS;
      deadlineRef.current = expires;
      timerRef.current = setTimeout(handleTimeout, QUESTION_TIME_LIMIT_MS);
    }
    if (hapticsEnabled) {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
  }, [handleTimeout, hapticsEnabled, target]);

  const onPressOut = React.useCallback(() => {
    if (!target || !expected || statusRef.current !== 'idle') return;
    if (pressStartRef.current == null) return;
    const elapsed = Date.now() - pressStartRef.current;
    pressStartRef.current = null;
    const stroke = classifyDuration(elapsed);
    const nextCode = userCodeRef.current + stroke;
    updateUserCode(nextCode);

    if (expected === nextCode) {
      if (hapticsEnabled) {
        (async () => {
          try {
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            );
          } catch {}
        })();
      }
      finishQuestion(true, nextCode, 'exact');
      return;
    }

    if (!expected.startsWith(nextCode)) {
      if (hapticsEnabled) {
        (async () => {
          try {
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Error,
            );
          } catch {}
        })();
      }
      finishQuestion(false, nextCode, 'error');
      return;
    }

    if (deadlineRef.current && Date.now() > deadlineRef.current) {
      finishQuestion(false, nextCode, 'timeout');
      return;
    }
  }, [classifyDuration, expected, finishQuestion, hapticsEnabled, target, updateUserCode]);

  const onPlay = React.useCallback(async () => {
    if (!expected || !target) return;
    await playMorseCode(expected, getMorseUnitMs(), {
      onSymbolStart: (symbol, durationMs) => {
        if (lightEnabled) pulseFlash(durationMs);
        if (hapticsEnabled) {
          Haptics.impactAsync(
            symbol === '.'
              ? Haptics.ImpactFeedbackStyle.Light
              : Haptics.ImpactFeedbackStyle.Medium,
          ).catch(() => {});
        }
      },
    });
  }, [expected, hapticsEnabled, lightEnabled, pulseFlash, target]);

  if (!groupObj || !lessonId || !charPool.length) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.errorTitle}>Lesson not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const headerTitle = lesson?.label ?? `Challenge ${lessonId.replace('ch-', '')}`;
  const headerSubtitle =
    !lesson && isChallenge
      ? formatSubtitle(charPool)
      : formatSubtitle(lesson?.chars ?? []);

  const letterColor =
    status === 'correct'
      ? theme.colors.success
      : status === 'wrong'
      ? theme.colors.error
      : theme.colors.textPrimary;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme.colors.textPrimary,
              opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18] }),
            },
          ]}
        />

        <View style={styles.headerCard}>
          <Pressable
            accessibilityLabel="Close lesson"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={22} color={theme.colors.background} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            {!!headerSubtitle && <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>}
            <Text style={styles.headerSend}>Send</Text>
          </View>
          <View style={styles.closeBtnPlaceholder} />
        </View>

        <LessonProgressBar ratio={progressRatio} />

        {summary ? (
          <SummaryView
            percent={summary.percent}
            correct={summary.correct}
            onRetry={startSession}
            onDone={() => router.back()}
          />
        ) : (
          <View style={styles.lessonBody}>
            <View style={styles.letterWrap}>
              <Text style={[styles.targetLetter, { color: letterColor }]}> 
                {target ?? 'Ã¢â‚¬â€'}
              </Text>
              {showHelp && expected ? (
                <Text style={styles.helpCode}>{prettify(expected)}</Text>
              ) : null}
              {feedback && (
                <View style={styles.feedbackBox}>
                  <Text style={styles.feedbackLabel}>Correct code</Text>
                  <Text style={styles.feedbackCode}>{prettify(feedback.expected)}</Text>
                  {!feedback.correct && (
                    <>
                      <Text style={styles.feedbackLabel}>You keyed</Text>
                      <Text style={[styles.feedbackCode, { color: theme.colors.error }]}>
                        {feedback.user ? prettify(feedback.user) : 'Ã¢â‚¬â€'}
                      </Text>
                    </>
                  )}
                  {feedback.reason === 'timeout' && (
                    <Text style={styles.feedbackHint}>Time expired</Text>
                  )}
                </View>
              )}
            </View>

            <View style={styles.controls}>
              <View style={styles.buttonRow}>
                <SquareButton
                  label={showHelp ? 'Hide Morse hint' : 'Show Morse hint'}
                  active={showHelp}
                  onPress={() => setShowHelp((prev) => !prev)}
                >
                  <Ionicons
                    name="help"
                    size={26}
                    color={showHelp ? theme.colors.accent : '#8A96A8'}
                  />
                </SquareButton>
                <SquareButton label="Play Morse" onPress={onPlay}>
                  <Ionicons name="play" size={28} color={theme.colors.accent} />
                </SquareButton>
              </View>

              <View style={styles.buttonRow}>
                <SquareButton
                  variant="toggle"
                  label={hapticsEnabled ? 'Disable haptics' : 'Enable haptics'}
                  active={hapticsEnabled}
                  onPress={() => setHapticsEnabled(!hapticsEnabled)}
                >
                  <MaterialCommunityIcons
                    name="vibrate"
                    size={26}
                    color={hapticsEnabled ? theme.colors.accent : '#666A75'}
                  />
                </SquareButton>
                <SquareButton
                  variant="toggle"
                  label={lightEnabled ? 'Disable screen flash' : 'Enable screen flash'}
                  active={lightEnabled}
                  onPress={() => setLightEnabled(!lightEnabled)}
                >
                  <MaterialCommunityIcons
                    name="cellphone"
                    size={26}
                    color={lightEnabled ? theme.colors.accent : '#666A75'}
                  />
                </SquareButton>
                <SquareButton
                  variant="toggle"
                  label={torchEnabled ? 'Disable flashlight' : 'Enable flashlight'}
                  active={torchEnabled}
                  onPress={() => setTorchEnabled(!torchEnabled)}
                >
                  <MaterialCommunityIcons
                    name="flashlight"
                    size={26}
                    color={torchEnabled ? theme.colors.accent : '#666A75'}
                  />
                </SquareButton>
                <SquareButton
                  variant="toggle"
                  label={audioEnabled ? 'Disable audio' : 'Enable audio'}
                  active={audioEnabled}
                  onPress={() => setAudioEnabled(!audioEnabled)}
                >
                  <MaterialCommunityIcons
                    name="volume-high"
                    size={26}
                    color={audioEnabled ? theme.colors.accent : '#666A75'}
                  />
                </SquareButton>
              </View>
            </View>

            <Pressable
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              style={({ pressed }) => [
                styles.keyer,
                pressed && styles.keyerPressed,
              ]}
              accessibilityLabel="Tap and hold to key"
            >
              <Text style={styles.keyerText}>Tap & Hold to Key</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing(4),
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(6),
  },
  headerCard: {
    backgroundColor: lessonColors.neonTeal,
    borderRadius: theme.radius.xl,
    paddingVertical: theme.spacing(4),
    paddingHorizontal: theme.spacing(4),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(4),
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPlaceholder: { width: 44, height: 44 },
  headerCenter: { alignItems: 'center', flex: 1, gap: theme.spacing(1) },
  headerTitle: {
    color: '#02161C',
    fontWeight: '800',
    fontSize: 20,
  },
  headerSubtitle: {
    color: '#04303A',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerSend: {
    color: '#02161C',
    fontWeight: '900',
    fontSize: 28,
    letterSpacing: 1,
  },
  progressTrack: {
    height: 10,
    width: '100%',
    backgroundColor: '#1C212A',
    borderRadius: 999,
    marginBottom: theme.spacing(6),
    overflow: 'hidden',
  },
  progressFillWrap: { height: '100%' },
  progressFill: { flex: 1 },
  lessonBody: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: theme.spacing(4),
  },
  letterWrap: { alignItems: 'center', gap: theme.spacing(3) },
  targetLetter: {
    fontSize: 96,
    fontWeight: '800',
    letterSpacing: 4,
  },
  helpCode: {
    color: theme.colors.accent,
    fontWeight: '700',
    fontSize: 24,
    letterSpacing: 6,
  },
  feedbackBox: {
    alignItems: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
  feedbackLabel: {
    color: theme.colors.muted,
    fontSize: theme.typography.small,
  },
  feedbackCode: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    letterSpacing: 6,
    fontSize: 20,
  },
  feedbackHint: {
    color: theme.colors.muted,
    fontSize: theme.typography.small,
  },
  controls: { gap: theme.spacing(4) },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing(2),
  },
  squareBase: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: 'transparent',
    elevation: 0,
  },
  squarePrimary: {
    borderColor: 'rgba(0,229,255,0.5)',
    backgroundColor: '#10191F',
  },
  squareToggle: {
    borderColor: '#2A2F36',
    backgroundColor: '#0F141A',
  },
  squareActive: {
    borderColor: theme.colors.accent,
    backgroundColor: 'rgba(0,229,255,0.18)',
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.65,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  keyer: {
    backgroundColor: 'rgba(0,229,255,0.08)',
    borderRadius: theme.radius.xl,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: lessonColors.border,
  },
  keyerPressed: { backgroundColor: 'rgba(0,229,255,0.16)' },
  keyerText: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    letterSpacing: 0.6,
    fontSize: 18,
  },
  summaryWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(6),
  },
  summaryTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: 24,
  },
  ringWrap: { justifyContent: 'center', alignItems: 'center' },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryPercent: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 1,
  },
  summarySub: {
    color: theme.colors.muted,
    marginTop: theme.spacing(1),
  },
  summaryActions: {
    width: '100%',
    gap: theme.spacing(3),
  },
  summaryBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.xl,
    paddingVertical: theme.spacing(4),
    alignItems: 'center',
  },
  summaryBtnText: {
    color: theme.colors.background,
    fontWeight: '800',
    fontSize: 18,
  },
  summaryBtnGhost: {
    borderRadius: theme.radius.xl,
    paddingVertical: theme.spacing(4),
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2A303A',
  },
  summaryBtnGhostText: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
  },
  errorTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: 22,
  },
  pressed: { opacity: 0.9 },
});
