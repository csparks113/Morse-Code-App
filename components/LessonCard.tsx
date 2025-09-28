import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  Animated,
  Easing,
} from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/theme/lessonTheme';

type Props = {
  kind: 'lesson' | 'review' | 'challenge';
  title: string;
  subtitle?: string;
  locked: boolean;
  receiveDone: boolean;
  sendDone: boolean;
  isActive: boolean; // receive available
  canSend: boolean; // send available
  onReceive: () => void;
  onSend: () => void;
  style?: ViewStyle;
};

/** Palette */
const GOLD_OUTLINE = colors.gold;
const GOLD_FILL = '#B8860B';
const CARD_BG = '#101214';
const GRAY_BORDER = '#2A2F36';
const GRAY_FILL = '#15171C';
const MUTED_ICON = '#3E424B';

// Two-tone blues from theme:
const DEEP_BLUE = colors.blueDeep; // unlocked / available
const NEON_BLUE = colors.blueNeon; // active / pulsing

const CROWN_SIZE = 28;
const BOOK_SIZE = 24;
const CIRCLE_SIZE = 52;

type CircleState = { active: boolean; completed: boolean; locked: boolean };

/** Pulse helper for active outline buttons */
function usePulse(enabled: boolean) {
  const scale = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (!enabled) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.08,
          duration: 950,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.0,
          duration: 950,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [enabled, scale]);
  return scale;
}

function CircleButton({
  state,
  iconName,
  onPress,
  accessibilityLabel,
}: {
  state: CircleState;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const isActiveOutline = state.active && !state.completed && !state.locked;
  const isUnlockedIdle = !state.locked && !state.completed && !state.active;

  const pulse = usePulse(isActiveOutline);

  // Resolve style
  let backgroundColor = GRAY_FILL;
  let borderColor = GRAY_BORDER;
  let iconColor: string = GRAY_BORDER;

  if (state.locked) {
    backgroundColor = GRAY_FILL;
    borderColor = GRAY_BORDER;
    iconColor = MUTED_ICON;
  } else if (state.completed) {
    backgroundColor = GOLD_FILL;
    borderColor = GOLD_OUTLINE;
    iconColor = GOLD_OUTLINE;
  } else if (isActiveOutline) {
    backgroundColor = 'transparent';
    borderColor = NEON_BLUE;
    iconColor = NEON_BLUE;
  } else if (isUnlockedIdle) {
    backgroundColor = 'transparent';
    borderColor = DEEP_BLUE;
    iconColor = DEEP_BLUE;
  }

  return (
    <Pressable
      disabled={state.locked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.circleBase,
        { backgroundColor, borderColor },
        pressed && !state.locked && { opacity: 0.92 },
      ]}
      accessibilityLabel={accessibilityLabel}
    >
      {isActiveOutline && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glowRing,
            {
              borderColor: NEON_BLUE,
              transform: [{ scale: pulse }],
              opacity: 0.55,
            },
          ]}
        />
      )}
      <MaterialCommunityIcons name={iconName} size={22} color={iconColor} />
    </Pressable>
  );
}

export default function LessonCard(p: Props) {
  const bothComplete = p.receiveDone && p.sendDone;

  // Per-side states
  const left: CircleState = {
    active: p.isActive && !p.receiveDone && !p.locked,
    completed: p.receiveDone,
    locked: p.locked,
  };
  const right: CircleState = {
    active: p.canSend && !p.sendDone && !p.locked,
    completed: p.sendDone,
    locked: p.locked || !p.canSend,
  };

  // Card border + subtitle logic
  const anyActive = (left.active || right.active) && !bothComplete;
  const anyUnlockedIdle =
    (!left.locked && !left.completed && !left.active) ||
    (!right.locked && !right.completed && !right.active);

  const cardBorder = bothComplete
    ? GOLD_OUTLINE
    : anyActive
    ? NEON_BLUE
    : anyUnlockedIdle
    ? DEEP_BLUE
    : GRAY_BORDER;

  const subtitleColor = bothComplete
    ? GOLD_OUTLINE
    : anyActive
    ? NEON_BLUE
    : anyUnlockedIdle
    ? DEEP_BLUE
    : MUTED_ICON;

  // Badge state for review/challenge icon
  const badgeState: 'none' | 'partial' | 'complete' = bothComplete
    ? 'complete'
    : anyActive
    ? 'partial'
    : 'none';

  // Accessibility label
  const label = p.subtitle ? `${p.title} ${p.subtitle}` : p.title;

  // Visible title rules:
  const visibleTitle =
    p.kind === 'review' ? 'Review' : p.kind === 'challenge' ? 'Challenge' : p.title;

  // Subtitle only for lesson
  const visibleSubtitle = p.kind === 'lesson' ? p.subtitle : undefined;

  const activeChallengeGlow = p.kind === 'challenge' && p.isActive;

  return (
    <View
      style={[
        styles.card,
        { borderColor: cardBorder },
        activeChallengeGlow && styles.activeChallengeGlow, // ★ faint neon glow on active Challenge
        p.style,
      ]}
      accessibilityLabel={label}
    >
      <CircleButton
        state={left}
        iconName="radar"
        onPress={p.onReceive}
        accessibilityLabel="Receive"
      />

      <View style={styles.center}>
        <Text style={styles.title}>{visibleTitle}</Text>

        {!!visibleSubtitle && (
          <Text style={[styles.subtitle, { color: subtitleColor }]}>
            {visibleSubtitle}
          </Text>
        )}

        {/* Badge under the title: Review (book), Challenge (crown) */}
        {p.kind === 'review' && <ReviewBook state={badgeState} />}
        {p.kind === 'challenge' && <ChallengeCrown state={badgeState} />}
      </View>

      <CircleButton
        state={right}
        iconName="antenna"
        onPress={p.onSend}
        accessibilityLabel="Send"
      />
    </View>
  );
}

// Crown: gray (none) → NEON blue (partial) → gold gradient (complete)
function ChallengeCrown({ state }: { state: 'none' | 'partial' | 'complete' }) {
  if (state === 'complete') {
    // Solid gold crown (no MaskedView), reliable across platforms
    return (
      <MaterialCommunityIcons
        name="crown"
        size={CROWN_SIZE}
        color={GOLD_OUTLINE}
        accessibilityLabel="Challenge complete"
      />
    );
  }
  if (state === 'partial') {
    return (
      <MaterialCommunityIcons
        name="crown"
        size={CROWN_SIZE}
        color={NEON_BLUE}
        accessibilityLabel="Challenge crown (in progress)"
      />
    );
  }
  return (
    <MaterialCommunityIcons
      name="crown-outline"
      size={CROWN_SIZE}
      color={GRAY_BORDER}
      accessibilityLabel="Challenge crown"
    />
  );
}

// Book: gray (none) → NEON blue (partial) → gold gradient (complete)
function ReviewBook({ state }: { state: 'none' | 'partial' | 'complete' }) {
  if (state === 'complete') {
    // Solid gold book (no MaskedView), reliable across platforms
    return (
      <MaterialCommunityIcons
        name="book-open-variant"
        size={BOOK_SIZE}
        color={GOLD_OUTLINE}
        accessibilityLabel="Review complete"
      />
    );
  }
  if (state === 'partial') {
    return (
      <MaterialCommunityIcons
        name="book-open-variant"
        size={BOOK_SIZE}
        color={NEON_BLUE}
        accessibilityLabel="Review (in progress)"
      />
    );
  }
  return (
    <MaterialCommunityIcons
      name="book-open-variant"
      size={BOOK_SIZE}
      color={GRAY_BORDER}
      accessibilityLabel="Review"
    />
  );
}


const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD_BG,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: GRAY_BORDER,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginVertical: 16,
  },

  /** ★ Added: faint neon glow for active Challenge (iOS: shadowColor; Android: elevation) */
  activeChallengeGlow: {
    shadowColor: NEON_BLUE,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8, // Android glow approximation
  },

  circleBase: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    overflow: 'visible',
  },
  glowRing: {
    position: 'absolute',
    width: CIRCLE_SIZE + 10,
    height: CIRCLE_SIZE + 10,
    borderRadius: (CIRCLE_SIZE + 10) / 2,
    borderWidth: 2,
  },
  center: { alignItems: 'center', justifyContent: 'center', flex: 1, gap: 4 },
  title: { color: '#FFFFFF', fontWeight: '800', fontSize: 18 },
  subtitle: { fontWeight: '800' , fontSize: 18},

  // Crown mask/gradient
  crownMask: {
    width: CROWN_SIZE,
    height: CROWN_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  crownGradient: { flex: 1 },

  // Book mask/gradient
  bookMask: {
    width: BOOK_SIZE,
    height: BOOK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  bookGradient: { flex: 1 },
});
