import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import colors from '../constants/colors';

export default function PlayButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.btn} onPress={onPress}>
      <Text style={styles.txt}>▶ Play</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  txt: { color: colors.background, fontWeight: '700' },
});
