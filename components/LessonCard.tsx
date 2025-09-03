import { View, Text, StyleSheet } from 'react-native';
import colors from '../constants/colors';
import { Level } from '../types';
import { Link, Href } from 'expo-router';
import { useLessonStore } from '../store/lessonStore';
import { useMemo } from 'react';

export default function LessonCard({ level }: { level: Level }) {
  // IMPORTANT: don't return new objects from the selector; it causes infinite re-renders.
  const charProgress = useLessonStore((s) => s.progress[level.id]);

  const doneCount = useMemo(() => {
    const obj = charProgress ?? {};
    return Object.values(obj).filter((n) => n >= 3).length;
  }, [charProgress]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{level.title}</Text>
      <Text style={styles.subtitle}>Chars: {level.chars.join(' ')}</Text>
      <Text style={styles.progress}>
        Progress: {doneCount}/{level.chars.length} mastered
      </Text>
      <View style={styles.row}>
        <Link
          style={styles.btn}
          href={
            {
              pathname: '/lesson/[lessonId]/receive',
              params: { lessonId: level.id },
            } satisfies Href
          }
        >
          <Text style={styles.btnText}>Receive</Text>
        </Link>
        <Link
          style={[styles.btn, styles.btnGhost]}
          href={
            {
              pathname: '/lesson/[lessonId]/send',
              params: { lessonId: level.id },
            } satisfies Href
          }
        >
          <Text style={styles.btnGhostText}>Send</Text>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  title: { color: colors.text, fontWeight: '800', fontSize: 16 },
  subtitle: { color: colors.muted },
  progress: { color: colors.muted },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
  btn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  btnText: { color: colors.background, fontWeight: '700' },
  btnGhost: {
    backgroundColor: 'transparent',
    borderColor: colors.accent,
    borderWidth: 1,
  },
  btnGhostText: { color: colors.accent, fontWeight: '700' },
});
