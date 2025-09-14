// Receive lesson screen: multiple-choice listening exercise.
// Picks a target letter from the lesson, plays its Morse, and asks the user to pick.
// When the answer is correct we mark 'receive' complete in the progress store.
import React from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../../../../constants/theme';
import {
  getLesson,
  getGroupById,
  LESSON_GROUPS,
} from '../../../../data/lessons';
import { playMorseForText, getMorseUnitMs } from '../../../../utils/audio';
import { useProgressStore } from '../../../../store/useProgressStore';
import { useSettingsStore } from '../../../../store/useSettingsStore';

export default function ReceiveLessonScreen() {
  const { group, lessonId } = useLocalSearchParams<{
    group: string;
    lessonId: string;
  }>();
  const lesson = getLesson(group!, lessonId!);
  const groupObj = getGroupById(group || 'alphabet');
  const markComplete = useProgressStore((s) => s.markComplete);
  const { lightEnabled, hapticsEnabled } = useSettingsStore();

  const [target, setTarget] = React.useState<string | null>(null);
  const [choices, setChoices] = React.useState<string[]>([]); // 4 options
  const [feedback, setFeedback] = React.useState<null | 'correct' | 'incorrect'>(null);

  // autoplay timer
  const autoplayRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flash overlay animation value (0..1)
  const flash = React.useRef(new Animated.Value(0)).current;

  // Visual flash overlay (if enabled)
  const pulseFlash = React.useCallback((durationMs: number) => {
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
  }, [lightEnabled, flash]);

  // Haptic feedback for dot/dash (if enabled)
  const hapticTick = React.useCallback(async (symbol: '.' | '-') => {
    if (!hapticsEnabled) return;
    if (symbol === '.')
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [hapticsEnabled]);

  const playNow = React.useCallback(async (ch: string) => {
    await playMorseForText(ch, getMorseUnitMs(), {
      onSymbolStart: (symbol, durationMs) => {
        pulseFlash(durationMs);
        hapticTick(symbol);
      },
    });
  }, [pulseFlash, hapticTick]);

  const rollNext = React.useCallback(
    (initial?: string) => {
      if (!lesson) return;
      const rand = initial ?? lesson.chars[Math.floor(Math.random() * lesson.chars.length)];
      setTarget(rand);
      setFeedback(null);

      // build 3 decoys
      const pool =
        groupObj?.lessons.flatMap((l) => l.chars).filter((c) => c !== rand) ??
        Array.from(new Set(LESSON_GROUPS.flatMap((g) => g.lessons.flatMap((l) => l.chars))))
          .filter((c) => c !== rand);

      const shuffled = [...new Set(pool)].sort(() => 0.5 - Math.random());
      const decoys = shuffled.slice(0, 3);
      const four = [...decoys, rand].sort(() => 0.5 - Math.random());
      setChoices(four);

      // Autoplay after 2s
      if (autoplayRef.current) clearTimeout(autoplayRef.current);
      autoplayRef.current = setTimeout(() => {
        playNow(rand);
      }, 2000);
    },
    [groupObj, lesson, playNow],
  );

  React.useEffect(() => {
    if (!lesson) return;
    rollNext();
    return () => {
      if (autoplayRef.current) clearTimeout(autoplayRef.current);
    };
  }, [lesson, rollNext]);

  // Note: keep hooks above; guard rendering below to satisfy hooks rules

  const onPlay = async () => {
    if (!target) return;
    await playNow(target);
  };

  const onAnswer = async (pick: string) => {
    if (!target) return;
    if (pick === target) {
      setFeedback('correct');
      // celebratory haptic
      (async () => {
        try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      })();
      // mark receive complete for this lesson
      markComplete(group!, lessonId!, 'receive');
      // roll to a new target in ~600ms
      setTimeout(() => rollNext(), 600);
    } else {
      setFeedback('incorrect');
      (async () => {
        try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
      })();
    }
  };

  if (!lesson) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>Lesson not found</Text>
        </View>
      </SafeAreaView>
    );
  }

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

        <Text style={styles.title}>{lesson.label} - Receive</Text>
        <Text style={styles.sub}>Characters: {lesson.chars.join(', ')}</Text>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Feedback and Play icon */}
        <View style={styles.feedbackRow}>
          <Text
            style={[
              styles.feedbackText,
              feedback === 'correct' && { color: theme.colors.success },
              feedback === 'incorrect' && { color: theme.colors.error },
            ]}
          >
            {feedback === 'correct' && 'Correct'}
            {feedback === 'incorrect' && 'Incorrect'}
          </Text>
          <Pressable
            onPress={onPlay}
            style={({ pressed }) => [styles.iconPlay, pressed && styles.btnPressed]}
            accessibilityLabel="Play tone"
          >
            <Ionicons name="play" size={20} color={theme.colors.background} />
          </Pressable>
        </View>

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

  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(3),
  },
  feedbackText: {
    color: theme.colors.muted,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  iconPlay: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
    borderColor: theme.colors.accent,
  },
  choiceText: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  choicePressed: { backgroundColor: '#081018' },
  btnPressed: { opacity: 0.92 },
});
