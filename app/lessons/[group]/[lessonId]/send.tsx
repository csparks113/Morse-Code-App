import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { theme } from '../../../../constants/theme';
import { getLesson } from '../../../../data/lessons';
import { toMorse } from '../../../../utils/morse';
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

  const classifyDuration = (ms: number): Stroke => (ms <= 170 ? '.' : '-');

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
    setStrokes((prev) => [...prev, s as Stroke]);
    setPressStart(null);
  };

  const onSubmit = async () => {
    const produced = strokes.join('');
    if (produced === expected) {
      if (hapticsEnabled) {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      }
      markComplete(group!, lessonId!, 'send');
      Alert.alert('Great keying!', `Matched ${target} (${expected})`, [
        { text: 'Back to Lessons', onPress: () => router.back() },
        {
          text: 'Try another',
          onPress: () => {
            const rand =
              lesson.chars[Math.floor(Math.random() * lesson.chars.length)];
            setTarget(rand);
            setExpected(toMorse(rand) ?? '');
            setStrokes([]);
          },
        },
      ]);
    } else {
      if (hapticsEnabled) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert(
        'Not quite',
        `You keyed "${produced}" but expected "${expected}".`,
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>{lesson.label} • Send</Text>
        <Text style={styles.sub}>
          Target: {target} ({expected || '?'})
        </Text>

        {/* Filler pushes controls to bottom */}
        <View style={{ flex: 1 }} />

        {/* Buttons above the keyer */}
        <View style={styles.rowButtons}>
          <Pressable
            onPress={onSubmit}
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          >
            <Text style={styles.btnText}>Submit</Text>
          </Pressable>

          <Pressable
            onPress={() => setStrokes([])}
            style={({ pressed }) => [
              styles.btnSecondary,
              pressed && styles.btnPressed,
            ]}
          >
            <Text style={styles.btnText}>Clear</Text>
          </Pressable>
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
  rowButtons: { flexDirection: 'row', gap: theme.spacing(2) },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: '800',
  },
  sub: { color: theme.colors.muted },
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
  btn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing(4),
    alignItems: 'center',
  },
  btnSecondary: {
    backgroundColor: theme.colors.textSecondary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing(4),
    alignItems: 'center',
  },
  btnPressed: { opacity: 0.9 },
  btnText: { color: theme.colors.background, fontWeight: '800' },
});
