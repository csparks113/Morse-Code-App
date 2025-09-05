import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { theme } from '../../../../constants/theme';
import {
  getLesson,
  getGroupById,
  LESSON_GROUPS,
} from '../../../../data/lessons';
import { playMorseForText, MORSE_UNIT_MS } from '../../../../utils/audio';
import { useProgressStore } from '../../../../store/useProgressStore';
import { useSettingsStore } from '../../../../store/useSettingsStore';

export default function ReceiveLessonScreen() {
  const { group, lessonId } = useLocalSearchParams<{
    group: string;
    lessonId: string;
  }>();
  const lesson = getLesson(group!, lessonId!);
  const groupObj = getGroupById(group || 'alphabet');
  const router = useRouter();
  const markComplete = useProgressStore((s) => s.markComplete);
  const { lightEnabled, hapticsEnabled } = useSettingsStore();

  const [target, setTarget] = React.useState<string | null>(null);
  const [choices, setChoices] = React.useState<string[]>([]); // 4 options

  // Flash overlay animation value (0..1)
  const flash = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!lesson) return;
    const rand = lesson.chars[Math.floor(Math.random() * lesson.chars.length)];
    setTarget(rand);

    // build 3 decoys
    const pool =
      groupObj?.lessons.flatMap((l) => l.chars).filter((c) => c !== rand) ??
      Array.from(
        new Set(
          LESSON_GROUPS.flatMap((g) => g.lessons.flatMap((l) => l.chars)),
        ),
      ).filter((c) => c !== rand);

    const shuffled = [...new Set(pool)].sort(() => 0.5 - Math.random());
    const decoys = shuffled.slice(0, 3);
    const four = [...decoys, rand].sort(() => 0.5 - Math.random());
    setChoices(four);
  }, [lesson]);

  if (!lesson) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>Lesson not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const pulseFlash = (durationMs: number) => {
    if (!lightEnabled) return;
    flash.setValue(0);
    Animated.sequence([
      Animated.timing(flash, {
        toValue: 0.9,
        duration: Math.min(80, durationMs / 3),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(flash, {
        toValue: 0,
        duration: Math.max(80, durationMs / 2),
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hapticTick = async (symbol: '.' | '-') => {
    if (!hapticsEnabled) return;
    if (symbol === '.')
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const onPlay = async () => {
    if (!target) return;
    await playMorseForText(target, MORSE_UNIT_MS, {
      onSymbolStart: (symbol, durationMs) => {
        pulseFlash(durationMs);
        hapticTick(symbol);
      },
    });
  };

  const onAnswer = (choice: string) => {
    if (!target) return;
    const correct = choice.toUpperCase() === target.toUpperCase();
    if (correct) {
      markComplete(group!, lessonId!, 'receive');
      Alert.alert('Nice!', `Correct: ${target}`, [
        { text: 'Back to Lessons', onPress: () => router.back() },
        {
          text: 'Next',
          onPress: () => {
            // roll a new target & options
            const rand =
              lesson.chars[Math.floor(Math.random() * lesson.chars.length)];
            setTarget(rand);
            const pool =
              groupObj?.lessons
                .flatMap((l) => l.chars)
                .filter((c) => c !== rand) ??
              Array.from(
                new Set(
                  LESSON_GROUPS.flatMap((g) =>
                    g.lessons.flatMap((l) => l.chars),
                  ),
                ),
              ).filter((c) => c !== rand);
            const shuffled = [...new Set(pool)].sort(() => 0.5 - Math.random());
            const decoys = shuffled.slice(0, 3);
            const four = [...decoys, rand].sort(() => 0.5 - Math.random());
            setChoices(four);
          },
        },
      ]);
    } else {
      Alert.alert('Try again', `You chose "${choice}". Not this time.`);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Flash overlay */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme.colors.textPrimary,
              opacity: flash.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.18],
              }),
            },
          ]}
        />

        <Text style={styles.title}>{lesson.label} • Receive</Text>
        <Text style={styles.sub}>Characters: {lesson.chars.join(', ')}</Text>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Play button centered */}
        <Pressable
          onPress={onPlay}
          style={({ pressed }) => [
            styles.playBtn,
            pressed && styles.btnPressed,
          ]}
        >
          <Text style={styles.playText}>Play Tone</Text>
        </Pressable>

        {/* 2x2 Multiple-choice grid at bottom */}
        <View style={styles.choiceGrid}>
          {choices.map((c) => (
            <Pressable
              key={c}
              onPress={() => onAnswer(c)}
              style={({ pressed }) => [
                styles.choiceSquare,
                pressed && styles.choicePressed,
              ]}
            >
              <Text style={styles.choiceText}>{c}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const BOX = 64;

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

  playBtn: {
    alignSelf: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing(3),
    paddingHorizontal: theme.spacing(5),
  },
  playText: { color: theme.colors.background, fontWeight: '800' },

  choiceGrid: {
    marginTop: theme.spacing(3),
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing(3),
    justifyContent: 'space-between',
  },
  choiceSquare: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    width: '48%', // 2 per row with gap
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.textSecondary,
  },
  choiceText: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  choicePressed: { backgroundColor: '#1E1A12' },
  btnPressed: { opacity: 0.92 },
});
