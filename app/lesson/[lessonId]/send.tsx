import { useLocalSearchParams, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import colors from '../../../constants/colors';
import { getLevelById } from '../../../constants/lessons';
import { charToMorse } from '../../../lib/morse';
import { playMorseForPattern } from '../../../lib/audio';
import { useLessonStore } from '../../../store/lessonStore';
import useHaptics from '../../../hooks/useHaptics';

export default function SendLesson() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const level = useMemo(() => getLevelById(lessonId), [lessonId]);
  const [target, setTarget] = useState(
    () => level.chars[Math.floor(Math.random() * level.chars.length)],
  );
  const [pattern, setPattern] = useState<string>('');
  const { markAttempt, markCorrect } = useLessonStore();
  const h = useHaptics();

  if (!level) return null;

  const expected = charToMorse(target);

  const submit = () => {
    const ok = pattern === expected;
    markAttempt(level.id, target, ok);
    if (ok) {
      h.success();
      markCorrect(level.id, target);
      const next = level.chars[Math.floor(Math.random() * level.chars.length)];
      setTarget(next);
      setPattern('');
    } else {
      h.error();
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: `${level.title} — Send`,
          headerTintColor: colors.accent,
        }}
      />

      <Text style={styles.prompt}>Send this character:</Text>
      <Text style={styles.target}>{target}</Text>

      <View style={styles.row}>
        <TouchableOpacity
          style={styles.key}
          onPress={() => setPattern((p) => p + '·')}
        >
          <Text style={styles.keyText}>·</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.key}
          onPress={() => setPattern((p) => p + '–')}
        >
          <Text style={styles.keyText}>–</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.key, styles.keyGhost]}
          onPress={() => setPattern('')}
        >
          <Text style={styles.keyGhostText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.pattern}>{pattern || ' '}</Text>

      <View style={styles.row}>
        <TouchableOpacity
          style={styles.play}
          onPress={() => playMorseForPattern(pattern)}
        >
          <Text style={styles.playText}>▶ Play</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.submit} onPress={submit}>
          <Text style={styles.submitText}>Check</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>Expected: {expected}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
    gap: 16,
  },
  prompt: { color: colors.text },
  target: {
    color: colors.accent,
    fontSize: 48,
    textAlign: 'center',
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  key: {
    backgroundColor: colors.surface,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  keyText: { color: colors.text, fontSize: 20, fontWeight: '700' },
  keyGhost: { backgroundColor: 'transparent' },
  keyGhostText: { color: colors.muted },
  pattern: {
    color: colors.text,
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 6,
  },
  play: {
    backgroundColor: colors.surface,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  playText: { color: colors.text, fontWeight: '700' },
  submit: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  submitText: { color: colors.background, fontWeight: '700' },
  hint: { color: colors.muted, textAlign: 'center' },
});
