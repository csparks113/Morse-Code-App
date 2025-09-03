import { View, Text, StyleSheet } from 'react-native';
import colors from '../constants/colors';

// Placeholder keyboard component for future expansion (not used in v1 flow)
export default function MorseKeyboard() {
  const rows = [
    ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    ['H', 'I', 'J', 'K', 'L', 'M', 'N'],
    ['O', 'P', 'Q', 'R', 'S', 'T', 'U'],
    ['V', 'W', 'X', 'Y', 'Z', '0', '1'],
  ];

  return (
    <View style={styles.container}>
      {rows.map((r, idx) => (
        <View style={styles.row} key={idx}>
          {r.map((ch) => (
            <View style={styles.key} key={ch}>
              <Text style={styles.keyText}>{ch}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  key: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  keyText: { color: colors.text, fontWeight: '700' },
});
