import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import colors from '../constants/colors';

export default function HeaderMenu({ title }: { title: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <TouchableOpacity style={styles.menu} onPress={() => {}}>
        <Text style={styles.menuText}>☰</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: { flex: 1, color: colors.accent, fontWeight: '800', fontSize: 18 },
  menu: { padding: 8 },
  menuText: { color: colors.text, fontSize: 22 },
});
