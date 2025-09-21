// components/session/RevealBar.tsx
import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { colors } from '@/theme/lessonTheme';

type Props = {
  morse?: string | null;
  visible: boolean;
  size?: 'sm' | 'md' | 'lg';
  align?: 'center' | 'left';
};

export default function RevealBar({ morse, visible, size = 'md', align = 'center' }: Props) {
  const [fs, ls, minH] =
    size === 'sm' ? [16, 4, 14] :
    size === 'lg' ? [26, 7, 26] :
    [20, 5, 18];

  return (
    <View style={[styles.slot, { minHeight: minH, alignItems: align === 'center' ? 'center' : 'flex-start' }]}>
      <Text
        style={[
          styles.text,
          { fontSize: fs, letterSpacing: ls, opacity: visible ? 1 : 0 },
        ]}
        numberOfLines={1}
        ellipsizeMode="clip"
      >
        {(morse ?? '').split('').join(' ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { alignSelf: 'stretch', justifyContent: 'center' },
  text: { color: colors.blueNeon, fontWeight: '700', textAlign: 'center' },
});
