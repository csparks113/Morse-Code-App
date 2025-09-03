import { Link } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../../constants/colors';
import { useLessonStore } from '../../store/lessonStore';
import { useSettingsStore } from '../../store/settingsStore';

export default function HomeScreen() {
  const completed = useLessonStore((s) => s.completedLevelIds.size);
  const language = useSettingsStore((s) => s.language);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Morse Code Master</Text>
      <Text style={styles.subtitle}>Language: {language.toUpperCase()}</Text>
      <View style={{ height: 16 }} />
      <Link href="/(tabs)/lessons" style={styles.cta}>
        Start Lessons
      </Link>
      <Link href="/(tabs)/practice" style={styles.secondary}>
        Free Practice
      </Link>
      <Text style={styles.footer}>Levels completed: {completed}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 12,
    backgroundColor: colors.background,
  },
  title: { fontSize: 28, fontWeight: '700', color: colors.accent },
  subtitle: { fontSize: 14, color: colors.muted },
  cta: {
    color: colors.background,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    textAlign: 'center',
    borderRadius: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },
  secondary: {
    color: colors.text,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    textAlign: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    overflow: 'hidden',
  },
  footer: { marginTop: 24, color: colors.muted },
});
