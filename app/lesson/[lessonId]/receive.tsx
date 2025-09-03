import { useLocalSearchParams, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import colors from '../../../constants/colors';
import { getLevelById } from '../../../constants/lessons';
import { playMorseForChar } from '../../../lib/audio';
import { useLessonStore } from '../../../store/lessonStore';
import useHaptics from '../../../hooks/useHaptics';

function makeOptions(target: string, pool: string[], count = 4) {
  const set = new Set<string>([target]);
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  for (const ch of shuffled) {
    if (set.size >= count) break;
    set.add(ch);
  }
  return [...set].sort(() => Math.random() - 0.5);
}

export default function ReceiveLesson() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const level = useMemo(() => getLevelById(lessonId), [lessonId]);
  const [target, setTarget] = useState(
    () => level.chars[Math.floor(Math.random() * level.chars.length)],
  );
  const [opts, setOpts] = useState(() => makeOptions(target, level.chars));
  const { markAttempt, markCorrect } = useLessonStore();
  const h = useHaptics();

  if (!level) return null;

  const next = () => {
    const t = level.chars[Math.floor(Math.random() * level.chars.length)];
    setTarget(t);
    setOpts(makeOptions(t, level.chars));
  };

  const handlePick = (pick: string) => {
    markAttempt(level.id, target, pick === target);
    if (pick === target) {
      h.success();
      markCorrect(level.id, target);
      next();
    } else {
      h.error();
      Alert.alert('Try again', `${pick} ≠ ${target}`);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: `${level.title} — Receive`,
          headerTintColor: colors.accent,
        }}
      />

      <Text style={styles.prompt}>Which letter/number is this?</Text>

      <TouchableOpacity
        style={styles.play}
        onPress={() => playMorseForChar(target)}
      >
        <Text style={styles.playText}>▶ Play</Text>
      </TouchableOpacity>

      <View style={styles.options}>
        {opts.map((o) => (
          <TouchableOpacity
            key={o}
            style={styles.option}
            onPress={() => handlePick(o)}
          >
            <Text style={styles.optionText}>{o}</Text>
          </TouchableOpacity>
        ))}
      </View>
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
  prompt: { color: colors.text, fontSize: 18 },
  play: {
    alignSelf: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  playText: { color: colors.background, fontWeight: '700' },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  option: {
    backgroundColor: colors.surface,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  optionText: { color: colors.text, fontSize: 20, fontWeight: '700' },
});
