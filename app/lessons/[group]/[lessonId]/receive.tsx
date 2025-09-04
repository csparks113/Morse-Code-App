// app/lessons/[group]/[lessonId]/receive.tsx
// ------------------------------------------
// Receive lesson flow: plays a random character (from this lesson's chars).
// User types the letter they heard and submits. We mark "receive" complete when correct,
// and show simple feedback.

import React from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { theme } from "../../../../constants/theme";
import { getLesson } from "../../../../data/lessons";
import { playMorseForText } from "../../../../utils/audio";
import { useProgressStore } from "../../../../store/useProgressStore";

export default function ReceiveLessonScreen() {
  const { group, lessonId } = useLocalSearchParams<{ group: string; lessonId: string }>();
  const lesson = getLesson(group!, lessonId!);
  const router = useRouter();
  const markComplete = useProgressStore((s) => s.markComplete);

  const [target, setTarget] = React.useState<string | null>(null);
  const [answer, setAnswer] = React.useState("");

  React.useEffect(() => {
    // Pick a random character to quiz each time we open.
    if (lesson) {
      const rand = lesson.chars[Math.floor(Math.random() * lesson.chars.length)];
      setTarget(rand);
    }
  }, [lesson]);

  if (!lesson) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Lesson not found</Text>
      </View>
    );
  }

  const onPlay = async () => {
    if (!target) return;
    await playMorseForText(target);
  };

  const onSubmit = () => {
    if (!target) return;
    if (answer.trim().toUpperCase() === target.toUpperCase()) {
      markComplete(group!, lessonId!, "receive");
      Alert.alert("Nice!", "Correct. Receive complete for this try.", [
        { text: "Back to Lessons", onPress: () => router.back() },
        { text: "Again", onPress: () => setAnswer("") },
      ]);
    } else {
      Alert.alert("Try again", `You entered "${answer}". The correct answer wasn't that.`, [
        { text: "OK", onPress: () => setAnswer("") },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{lesson.label} • Receive</Text>
      <Text style={styles.sub}>Characters: {lesson.chars.join(", ")}</Text>

      <Pressable onPress={onPlay} style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}>
        <Text style={styles.btnText}>Play Tone</Text>
      </Pressable>

      <TextInput
        placeholder="Type the letter/number you heard"
        placeholderTextColor={theme.colors.muted}
        value={answer}
        onChangeText={setAnswer}
        autoCapitalize="characters"
        autoCorrect={false}
        style={styles.input}
      />

      <Pressable onPress={onSubmit} style={({ pressed }) => [styles.btnSecondary, pressed && styles.btnPressed]}>
        <Text style={styles.btnText}>Submit</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(4), gap: theme.spacing(3) },
  title: { color: theme.colors.textPrimary, fontSize: theme.typography.title, fontWeight: "800" },
  sub: { color: theme.colors.muted },
  btn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing(4),
    alignItems: "center",
  },
  btnSecondary: {
    backgroundColor: theme.colors.textSecondary,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing(4),
    alignItems: "center",
  },
  btnPressed: { opacity: 0.9 },
  btnText: { color: theme.colors.background, fontWeight: "800" },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing(4),
    color: theme.colors.textPrimary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
});
