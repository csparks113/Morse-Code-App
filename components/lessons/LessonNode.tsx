import React from 'react';
import { Pressable, StyleSheet, Animated, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../theme/lessonTheme';
import DotDash from './icons/DotDash';
import AntennaWaves from './icons/AntennaWaves';
import Star from './icons/Star';
import Shield from './icons/Shield';
import Crown from './icons/Crown';

export type NodeStatus =
  | 'LOCKED'
  | 'AVAILABLE'
  | 'RECEIVE_DONE'
  | 'MASTERED'
  | 'CHALLENGE_AVAILABLE'
  | 'CHALLENGE_RECEIVE_DONE'
  | 'CHALLENGE_MASTERED';

type Props = {
  index: number;
  isChallenge: boolean;
  status: NodeStatus;
  onPress: () => void;
  open?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

const SIZE = 68;

// A single circular node rendered on the path.
// Color + icon reflect current state. Tap triggers haptic and opens the prompt.
export default function LessonNode(props: Props) {
  const {
    index,
    isChallenge,
    status,
    onPress,
    open,
    style,
    accessibilityLabel,
  } = props;
  const scale = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    // tiny pulse when state changes to a completed tier
    if (
      status === 'RECEIVE_DONE' ||
      status === 'MASTERED' ||
      status === 'CHALLENGE_RECEIVE_DONE' ||
      status === 'CHALLENGE_MASTERED'
    ) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.05, duration: 100, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      ]).start();
    }
  }, [status]);

  const { fill, Icon } = getVisuals(status);
  const shade = darken(fill, 0.45);

  const onPressNode = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onPress();
  };

  return (
    <Pressable onPress={onPressNode} accessibilityLabel={accessibilityLabel} accessibilityRole="button">
      <Animated.View
        style={[
          styles.circle,
          { backgroundColor: fill, borderColor: shade, shadowColor: fill },
          open && { transform: [{ scale: scale }] },
          style,
        ]}
      >
        <Icon color={shade} size={22} />
      </Animated.View>
    </Pressable>
  );
}

function getVisuals(status: NodeStatus): { fill: string; Icon: (p: { size?: number; color?: string }) => JSX.Element } {
  switch (status) {
    case 'AVAILABLE':
      return { fill: colors.blue, Icon: (p) => <DotDash {...p} /> };
    case 'RECEIVE_DONE':
      return { fill: colors.green, Icon: (p) => <AntennaWaves {...p} /> };
    case 'MASTERED':
      return { fill: colors.gold, Icon: (p) => <Star {...p} /> };
    case 'CHALLENGE_AVAILABLE':
      return { fill: colors.purple, Icon: (p) => <DotDash {...p} /> };
    case 'CHALLENGE_RECEIVE_DONE':
      return { fill: colors.silver, Icon: (p) => <Shield {...p} /> };
    case 'CHALLENGE_MASTERED':
      return { fill: colors.gold, Icon: (p) => <Crown {...p} /> };
    default:
      return { fill: '#202020', Icon: (p) => <DotDash {...p} /> };
  }
}

const styles = StyleSheet.create({
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    // dynamic shadow set in component for color
    shadowOpacity: 0.75,
    shadowRadius: 18,
    elevation: 16,
  },
});

function darken(hex: string, amount = 0.3) {
  // hex like #RRGGBB
  const c = hex.replace('#', '');
  const num = parseInt(c, 16);
  const r = Math.max(0, Math.min(255, Math.floor(((num >> 16) & 0xff) * (1 - amount))))
    .toString(16)
    .padStart(2, '0');
  const g = Math.max(0, Math.min(255, Math.floor(((num >> 8) & 0xff) * (1 - amount))))
    .toString(16)
    .padStart(2, '0');
  const b = Math.max(0, Math.min(255, Math.floor((num & 0xff) * (1 - amount))))
    .toString(16)
    .padStart(2, '0');
  return `#${r}${g}${b}`;
}




