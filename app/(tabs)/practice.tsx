import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import colors from '../../constants/colors';
import { playMorseForText } from '../../lib/audio';
import { textToMorse, morseToText } from '../../lib/morse';

export default function PracticeScreen() {
  const [text, setText] = useState('');
  const [morse, setMorse] = useState('');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Free Practice</Text>
      <Text style={styles.label}>Plain text</Text>
      <TextInput
        style={styles.input}
        placeholder="Type letters or numbers"
        placeholderTextColor={colors.muted}
        value={text}
        onChangeText={(t) => {
          setText(t);
          setMorse(textToMorse(t));
        }}
      />
      <TouchableOpacity
        style={styles.btn}
        onPress={() => playMorseForText(text)}
      >
        <Text style={styles.btnText}>Play Morse</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Morse (· = dot, – = dash)</Text>
      <TextInput
        style={styles.input}
        placeholder="· –"
        placeholderTextColor={colors.muted}
        value={morse}
        onChangeText={(m) => {
          setMorse(m);
          setText(morseToText(m));
        }}
      />
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
  label: { color: colors.muted },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.text,
    padding: 12,
  },
  btn: { backgroundColor: colors.accent, borderRadius: 12, padding: 12 },
  btnText: { textAlign: 'center', color: colors.background, fontWeight: '700' },
});
