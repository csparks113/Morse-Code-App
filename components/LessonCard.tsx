import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme/lessonTheme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Props = {
  kind: 'lesson' | 'challenge';
  title: string;
  subtitle?: string;
  locked: boolean;
  receiveDone: boolean;
  sendDone: boolean;
  isActive: boolean;
  canSend: boolean;
  onReceive: () => void;
  onSend: () => void;
  style?: ViewStyle;
};

const goldOutline = '#FFD700';
const goldFill = '#B8860B';
const cardBg = '#101214';
const grayBorder = '#2A2F36';
const grayFill = '#15171C';
const mutedIcon = '#3E424B';
const crownSize = 28;

type CircleState = { active: boolean; completed: boolean; locked: boolean };

function circleStyles({ active, completed, locked }: CircleState) {
  if (locked) return { bg: grayFill, border: grayBorder, icon: mutedIcon };
  if (completed) return { bg: goldFill, border: goldOutline, icon: goldOutline };
  if (active) return { bg: colors.blue, border: colors.border, icon: colors.border };
  return { bg: grayFill, border: grayBorder, icon: grayBorder };
}

export default function LessonCard(p: Props) {
  const bothComplete = p.receiveDone && p.sendDone;
  const outline = bothComplete ? goldOutline : grayBorder;
  const label = p.subtitle ? `${p.title} ${p.subtitle}` : p.title;

  const left = circleStyles({ active: p.isActive && !p.receiveDone && !p.locked, completed: p.receiveDone, locked: p.locked });
  const right = circleStyles({ active: p.canSend && !p.sendDone && !p.locked, completed: p.sendDone, locked: p.locked || !p.canSend });

  return (
    <View
      style={[styles.card, { borderColor: outline }, p.style]}
      accessibilityLabel={label}
    >
      <Pressable
        disabled={p.locked}
        onPress={p.onReceive}
        style={({ pressed }) => [
          styles.circle,
          { backgroundColor: left.bg, borderColor: left.border },
          pressed && !p.locked && { opacity: 0.92 },
        ]}
        accessibilityLabel="Receive"
      >
        <MaterialCommunityIcons name="radar" size={22} color={left.icon as string} />
      </Pressable>
      <View style={styles.center}>
        {p.kind === 'lesson' ? (
          <>
            <Text style={styles.title}>{p.title}</Text>
            {!!p.subtitle && <Text style={styles.subtitle}>{p.subtitle}</Text>}
          </>
        ) : (
          <>
            <Text style={styles.title}>Challenge</Text>
            <ChallengeCrown filled={bothComplete} />
          </>
        )}
      </View>
      <Pressable
        disabled={p.locked || !p.canSend}
        onPress={p.onSend}
        style={({ pressed }) => [
          styles.circle,
          { backgroundColor: right.bg, borderColor: right.border },
          pressed && !(p.locked || !p.canSend) && { opacity: 0.92 },
        ]}
        accessibilityLabel="Send"
      >
        <MaterialCommunityIcons name="antenna" size={22} color={right.icon as string} />
      </Pressable>
    </View>
  );
}

function ChallengeCrown({ filled }: { filled: boolean }) {
  if (!filled) {
    return (
      <MaterialCommunityIcons
        name="crown-outline"
        size={crownSize}
        color={grayBorder}
        accessibilityLabel="Challenge crown"
      />
    );
  }

  return (
    <MaskedView
      style={styles.crownMask}
      maskElement={(
        <View style={styles.crownMask}>
          <MaterialCommunityIcons name="crown" size={crownSize} color="#fff" />
        </View>
      )}
    >
      <LinearGradient
        colors={['#FFD700', '#FFC837', '#FFB347']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.crownGradient}
      />
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: cardBg,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: grayBorder,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginVertical: 10,
  },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  center: { alignItems: 'center', justifyContent: 'center', flex: 1, gap: 4 },
  title: { color: '#FFFFFF', fontWeight: '800', fontSize: 18 },
  subtitle: { color: colors.neonTeal, fontWeight: '800' },
  crownMask: {
    width: crownSize,
    height: crownSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crownGradient: {
    flex: 1,
  },
});
