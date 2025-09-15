// LessonPromptCard
// ----------------
// Small action panel that appears under a lesson node.
// Shows lesson title, cheat sheet (letter -> morse), and two actions:
//  - Receive: always enabled
//  - Send: enabled only after Receive meets threshold
// Includes a tiny fade/scale entrance to feel responsive.
import React from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, glow, radii, spacing } from '../theme/lessonTheme';
import { toMorse } from '../utils/morse';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
// icons not used for buttons after reverting styles

type Props = {
  groupId: string;
  lessonId: string;
  label: string;
  chars: string[];
  canSend: boolean;
  disableActions?: boolean; // when true, both buttons are disabled (used for challenge placeholder)
  locked?: boolean; // when true, render a simple locked state
};

export default function LessonPromptCard({
  groupId,
  lessonId,
  label,
  chars,
  canSend,
  disableActions,
  locked,
}: Props) {
  const router = useRouter();
  const opacity = React.useRef(new Animated.Value(0)).current;
  const scale = React.useRef(new Animated.Value(0.96)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    (async () => {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    })();
  }, [opacity, scale]);

  const receiveHref: Href = {
    pathname: '/lessons/[group]/[lessonId]/receive',
    params: { group: groupId, lessonId },
  };
  const sendHref: Href = {
    pathname: '/lessons/[group]/[lessonId]/send',
    params: { group: groupId, lessonId },
  };

  return (
    <Animated.View style={[styles.wrap, { opacity, transform: [{ scale }] }]}> 
      <View style={styles.arrow} />
      <View style={styles.card}>
        {!locked && !disableActions && (
          <View style={styles.charsRow}>
            {chars.map((c) => (
              <View key={c} style={styles.pill}>
                <Text style={styles.pillText}>{c}</Text>
                <Text style={styles.pillCode}>{toMorse(c)}</Text>
              </View>
            ))}
          </View>
        )}
        {locked ? (
          <View style={styles.lockedRow}>
            <Text style={styles.lockedText}>Locked</Text>
          </View>
        ) : (
        <View style={styles.actionsRow}>
          <Pressable
          
            onPress={() => router.push(receiveHref)}
            style={({ pressed }) => [
              styles.btn,
              styles.btnReceive,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={'Start Receive'}
            hitSlop={8}
          >
            <Ionicons name="radio" size={18} color="#FFFFFF" />
            <Text style={styles.btnLabel}>Receive</Text>
          </Pressable>
          <Pressable
            disabled={!canSend}
            onPress={() => router.push(sendHref)}
            style={({ pressed }) => [
              styles.btn,
              styles.btnSend,
              !canSend && styles.btnDisabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              canSend ? 'Start Send' : 'Send locked until Receive complete'
            }
            hitSlop={8}
          >
            <MaterialCommunityIcons name="antenna" size={18} color="#FFFFFF" />
            <Text style={styles.btnLabel}>Send</Text>
            <Text style={styles.btnLabel}>{canSend ? '' : '(locked)'}</Text>
          </Pressable>
        </View> )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    marginTop: spacing(2),
    alignItems: 'center',
    zIndex: 3,
    position: 'absolute',
    left: 0,
    right: 0,
    top: spacing(13.5), // just beneath the coin circle
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.border,
  },
  card: {
    marginTop: -1,
    alignSelf: 'stretch',
    marginHorizontal: spacing(0.25),
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing(2),
    ...glow.medium,
  },
  charsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginBottom: spacing(4),
    justifyContent: 'space-evenly',
  },
  pill: {
    backgroundColor: '#151515',
    borderRadius: radii.xl,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(1),
    width: '36%',
    alignItems: 'center',
  },
  pillText: { color: colors.text, fontWeight: '900', fontSize: 22 },
  pillCode: { color: colors.textDim, fontSize: 16, marginTop: 4 },
  actionsRow: { flexDirection: 'row', gap: spacing(3), justifyContent: 'space-between' },
  btn: {
    flex: 1,
    minHeight: 50,
    minWidth: 90,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing(1.5),
    paddingHorizontal: spacing(1),
  },
  btnReceive: { backgroundColor: colors.green },
  btnSend: { backgroundColor: colors.gold },
  btnDisabled: { opacity: 0.5 },
  btnLabel: { color: '#FFFFFF', fontWeight: '800' },
  pressed: { opacity: 0.92 },
  lockedRow: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing(1) },
  lockedText: { color: colors.text, fontSize: 16, fontWeight: '800' },
});
