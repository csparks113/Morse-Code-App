import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '@/theme/lessonTheme';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

type Props = {
  title: string;
  subtitle?: string;
  locked: boolean;
  receiveDone: boolean;
  sendDone: boolean;
  isActive: boolean; // initial active (receive)
  canSend: boolean; // true when receive is completed
  onReceive: () => void;
  onSend: () => void;
  style?: ViewStyle;
};

export default function PillLessonNode(p: Props) {
  const goldOutline = '#FFD700';
  const goldFill = '#B8860B'; // bronze-like fill
  const grayFill = '#1B1E23';
  const grayBorder = '#2A2F36';

  const leftActive = !p.receiveDone && p.isActive && !p.locked;
  const rightActive = p.canSend && !p.sendDone && !p.locked; // send becomes active after receive

  const leftCompleted = p.receiveDone;
  const rightCompleted = p.sendDone;

  return (
    <View style={[styles.wrap, p.style]}
      accessibilityLabel={`${p.title} ${p.subtitle ?? ''}`}
    >
      <Text style={styles.title}>{p.title}</Text>
      {!!p.subtitle && (
        <Text style={styles.subtitle}>{p.subtitle}</Text>
      )}
      <View style={styles.pill}>
        {/* Receive half */}
        <Pressable
          disabled={p.locked}
          onPress={p.onReceive}
          style={({ pressed }) => [
            styles.half,
            styles.left,
            p.locked && styles.locked,
            leftActive && styles.activeOutline,
            leftCompleted && { backgroundColor: goldFill, borderColor: goldOutline },
            pressed && { opacity: 0.92 },
          ]}
        >
          <Ionicons
            name="radio"
            size={18}
            color={leftCompleted ? '#FFFFFF' : leftActive ? colors.blue : '#9BA0A6'}
          />
          <Text style={[styles.btnLabel, leftCompleted && { color: '#FFFFFF' }]}>Receive</Text>
        </Pressable>

        {/* Divider */}
        <View style={styles.split} />

        {/* Send half */}
        <Pressable
          disabled={p.locked || !p.canSend}
          onPress={p.onSend}
          style={({ pressed }) => [
            styles.half,
            styles.right,
            p.locked && styles.locked,
            rightActive && styles.activeOutline,
            rightCompleted && { backgroundColor: goldFill, borderColor: goldOutline },
            pressed && { opacity: 0.92 },
          ]}
        >
          <MaterialCommunityIcons
            name="antenna"
            size={18}
            color={rightCompleted ? '#FFFFFF' : rightActive ? colors.blue : '#9BA0A6'}
          />
          <Text style={[styles.btnLabel, rightCompleted && { color: '#FFFFFF' }]}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  title: { color: '#fff', fontWeight: '800', fontSize: 20, marginBottom: 6 },
  subtitle: { color: 'rgba(255,255,255,0.7)', marginBottom: 10 },
  pill: {
    flexDirection: 'row',
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'stretch',
    borderWidth: 2,
    borderColor: '#222',
  },
  half: {
    flex: 1,
    minWidth: 120,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: '#101214',
    borderColor: '#222',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  left: { borderTopLeftRadius: 999, borderBottomLeftRadius: 999 },
  right: { borderTopRightRadius: 999, borderBottomRightRadius: 999 },
  split: { width: 1, backgroundColor: '#0A0C10' },
  locked: { backgroundColor: '#15171C', borderColor: '#2A2F36' },
  activeOutline: {
    borderColor: colors.blue,
    shadowColor: colors.blue,
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 12,
  },
  btnLabel: { color: '#EAEAEA', fontWeight: '800' },
});
