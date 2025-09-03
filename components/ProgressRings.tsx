import { View, StyleSheet } from 'react-native';
import colors from '../constants/colors';

// Simple 3-dot indicator (fills toward gold as you answer correctly)
export default function ProgressRings({ count }: { count: number }) {
  return (
    <View style={styles.row}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.dot, i < count && styles.dotOn]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.muted,
  },
  dotOn: { backgroundColor: colors.gold, borderColor: colors.gold },
});
