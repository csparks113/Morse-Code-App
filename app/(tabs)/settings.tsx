import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import colors from '../../constants/colors';
import { useSettingsStore } from '../../store/settingsStore';

export default function SettingsScreen() {
  const { language, setLanguage, wpm, setWpm, soundOn, toggleSound } =
    useSettingsStore();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.label}>Language</Text>
      <View style={styles.row}>
        {['en', 'es', 'fr', 'de'].map((lng) => (
          <TouchableOpacity
            key={lng}
            style={[styles.pill, language === lng && styles.pillActive]}
            onPress={() => setLanguage(lng as any)}
          >
            <Text
              style={[
                styles.pillText,
                language === lng && styles.pillTextActive,
              ]}
            >
              {lng.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Sound</Text>
      <TouchableOpacity style={styles.toggle} onPress={toggleSound}>
        <Text style={styles.toggleText}>{soundOn ? 'On' : 'Off'}</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Speed (WPM)</Text>
      <View style={styles.row}>
        {[10, 15, 20, 25].map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.pill, wpm === n && styles.pillActive]}
            onPress={() => setWpm(n)}
          >
            <Text style={[styles.pillText, wpm === n && styles.pillTextActive]}>
              {n}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.background,
    gap: 12,
  },
  title: { fontSize: 22, color: colors.accent, fontWeight: '700' },
  label: { color: colors.muted, marginTop: 8 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.muted,
  },
  pillActive: { borderColor: colors.accent },
  pillText: { color: colors.text },
  pillTextActive: { color: colors.accent, fontWeight: '700' },
  toggle: {
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  toggleText: { color: colors.text, textAlign: 'center', fontWeight: '700' },
});
