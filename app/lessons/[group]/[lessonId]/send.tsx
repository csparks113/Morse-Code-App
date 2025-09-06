import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { theme } from '../../../../constants/theme';
import { getLesson } from '../../../../data/lessons';
import { toMorse } from '../../../../utils/morse';
import { getMorseUnitMs } from '../../../../utils/audio';
import { useProgressStore } from '../../../../store/useProgressStore';
import { useSettingsStore } from '../../../../store/useSettingsStore';
import { SafeAreaView } from 'react-native-safe-area-context';

type Stroke = '.' | '-';

export default function SendLessonScreen() {
  const { group, lessonId } = useLocalSearchParams<{
    group: string;
    lessonId: string;
  }>();
  const lesson = getLesson(group!, lessonId!);
  const router = useRouter();
  const markComplete = useProgressStore((s) => s.markComplete);
  const { hapticsEnabled } = useSettingsStore();

  const [target, setTarget] = React.useState<string | null>(null);
  const [expected, setExpected] = React.useState<string>('');
  const [status, setStatus] = React.useState<'idle' | 'success'>('idle');
  const [strokes, setStrokes] = React.useState<Stroke[]>([]);
  const [pressStart, setPressStart] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (lesson) {
      const rand =
        lesson.chars[Math.floor(Math.random() * lesson.chars.length)];
      setTarget(rand);
      setExpected(toMorse(rand) ?? '');
      setStrokes([]);
    }
  }, [lesson]);

  if (!lesson) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Lesson not found</Text>
      </View>
    );
  }

  const classifyDuration = (ms: number): Stroke => {
    const unit = getMorseUnitMs();
    const threshold = 2 * unit; // <= 2 units = dot, else dash
    return ms <= threshold ? '.' : '-';
  };

  const onPressIn = async () => {
    setPressStart(Date.now());
    if (hapticsEnabled) {
      // Quick tick on touch-down for tactile feel
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const onPressOut = () => {
    if (pressStart == null) return;
    const elapsed = Date.now() - pressStart;
    const s = classifyDuration(elapsed);
    setStrokes((prev) => {
      const next = [...prev, s as Stroke];
      const produced = next.join('');
      if (expected.startsWith(produced)) {
        if (produced.length === expected.length) {
          // success
          (async () => {
            if (hapticsEnabled) {
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
            }
          })();
          setStatus('success');
          markComplete(group!, lessonId!, 'send');
          setTimeout(() => {
            const rand =
              lesson!.chars[Math.floor(Math.random() * lesson!.chars.length)];
            setTarget(rand);
            setExpected(toMorse(rand) ?? '');
            setStrokes([]);
            setStatus('idle');
          }, 700);
        }
        return next;
      } else {
        // wrong path; reset for retry with error haptic
        (async () => {
          if (hapticsEnabled) {
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Error,
            );
          }
        })();
        return [];
      }
    });
    setPressStart(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>{lesson.label} - Send</Text>
        {/* Big target letter */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            style={[
              styles.targetBig,
              status === 'success' && { color: theme.colors.success },
            ]}
          >
            {target}
          </Text>
        </View>

        {/* Bottom keyer */}
        <Pressable
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={({ pressed }) => [
            styles.keyer,
            pressed && styles.keyerPressed,
          ]}
        >
          <Text style={styles.keyerText}>Tap & Hold to Key</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing(4),
    gap: theme.spacing(3),
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: '800',
  },
  sub: { color: theme.colors.muted },
  targetBig: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    fontSize: 72,
    letterSpacing: 2,
  },
  keyer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.textSecondary,
    ...theme.shadow.card,
  },
  keyerPressed: { backgroundColor: '#1F1A12' },
  keyerText: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  strokes: { color: theme.colors.textPrimary },
  btnPressed: { opacity: 0.9 },
});
