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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme/lessonTheme';
import DishWithWifi from './icons/DishWithWifi';
import AntennaWithWifi from './icons/AntennaWithWifi';

type Props = {
  kind: 'lesson' | 'review' | 'challenge';
  title: string;
  subtitle?: string;
  locked: boolean;
  receiveDone: boolean;
  sendDone: boolean;
  isActive: boolean; // receive available
  canSend: boolean;  // send available
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
const CIRCLE_SIZE = 60;

type CircleState = { active: boolean; completed: boolean; locked: boolean };

/** Option A — soft breath (opacity-only halo) */
function useBreath(enabled: boolean, period = 1800, min = 0.15, max = 0.38) {
  const v = React.useRef(new Animated.Value(min)).current;
  React.useEffect(() => {
    if (!enabled) { v.setValue(min); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: max, duration: period / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: min, duration: period / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [enabled, period, min, max]);
  return v; // opacity
}

/**
 * Generic circular icon button.
 * - If `renderIcon` is provided, it renders instead of the default Material icon.
 */
function CircleButton({
  state,
  iconName,
  onPress,
  accessibilityLabel,
  renderIcon,
}: {
  state: CircleState;
  iconName?: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  renderIcon?: (args: {
    size: number;
    color: string;
    state: CircleState;
  }) => React.ReactNode;
}) {
  const isActiveOutline = state.active && !state.completed && !state.locked;
  const isUnlockedIdle = !state.locked && !state.completed && !state.active;

  // subtle breathing halo instead of scale pulse
  const breath = useBreath(isActiveOutline);

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

  const innerSize = CIRCLE_SIZE - 8;

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
              opacity: breath,      // ← opacity-only breath
              // no transform/scale to keep motion minimal
            },
          ]}
        />
      )}

      {/* Icon slot */}
      <View
        style={{
          width: innerSize,
          height: innerSize,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        pointerEvents="none"
      >
        {renderIcon ? (
          renderIcon({ size: innerSize, color: iconColor, state })
        ) : iconName ? (
          <MaterialCommunityIcons
            name={iconName}
            size={Math.round(innerSize * 0.56)}   // scales with circle
            color={iconColor}
            style={{ transform: [{ translateY: 1 }] }} // tiny optical center
          />
        ) : null}
      </View>
    </Pressable>
  );
}

/** Map CircleState -> Dish visual state */
function toReceiveState(s: CircleState): 'active' | 'inactive' | 'completed' {
  if (s.completed) return 'completed';
  if (s.active) return 'active';
  return 'inactive';
}

/** Map CircleState -> Antenna visual state */
function toSendState(s: CircleState): 'active' | 'inactive' | 'completed' {
  if (s.completed) return 'completed';
  if (s.active) return 'active';
  return 'inactive';
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
      {/* LEFT: Receive (dish + Wi-Fi overlay) */}
      <CircleButton
        state={left}
        onPress={p.onReceive}
        accessibilityLabel="Receive"
        renderIcon={({ size, state }) => (
          <DishWithWifi
            state={toReceiveState(state)}
            size={size}
            // independent scaling controls
            dishScale={0.5}
            wifiScale={1.02}
            // overall micro-nudge for optical centering
            style={{ transform: [{ translateY: 1 }] }}
            // make completed state gold instead of black
            completedTint={GOLD_OUTLINE}
            inactiveTint={MUTED_ICON}
            wifi={{
              // wifi position (DO NOT CHANGE)
              originX: 0.87,
              originY: 0.18,
              rotationDeg: 150,
              spanDeg: 105,
              baseRadius: size * 0.10,
              gap: size * 0.085,
              strokeWidth: 2,
              colorActive: '#00E5FF',
              colorCompleted: GOLD_OUTLINE,
              // micro-adjust waves independently
              offsetX: 0,
              offsetY: -0.5,
            }}
            // dish position (DO NOT CHANGE)
            imageStyle={{ transform: [{ translateX: -5 }, { translateY: 2 }] }}
          />
        )}
      />

      {/* CENTER: Title + subtitle + badges */}
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

      {/* RIGHT: Send (antenna + dual Wi-Fi) */}
      <CircleButton
        state={right}
        onPress={p.onSend}
        accessibilityLabel="Send"
        renderIcon={({ size, state }) => (
          <AntennaWithWifi
            state={toSendState(state)}
            size={size}
            // slight inset + overall optical nudge
            towerScale={0.6}
            wifiScale={1.0}
            style={{ transform: [{ translateY: 5 }] }}
            // assets + outline tints
            completedTint={GOLD_OUTLINE}
            inactiveTint={MUTED_ICON}
            // beams: active animated, completed static, inactive hidden
            rightWifi={{
              colorActive: colors.blueNeon,
              colorCompleted: GOLD_OUTLINE,
              originX: 0.55,
              originY: 0.26,
              rotationDeg: 0,
              spanDeg: 105,
              baseRadius: size * 0.10,
              gap: size * 0.085,
              strokeWidth: 2,
              offsetY: -0.5,
            }}
            leftWifi={{
              colorActive: colors.blueNeon,
              colorCompleted: GOLD_OUTLINE,
              originX: 0.45,
              originY: 0.26,
              rotationDeg: 180,
              spanDeg: 105,
              baseRadius: size * 0.10,
              gap: size * 0.085,
              strokeWidth: 2,
              offsetY: -0.5,
            }}
          />
        )}
      />
    </View>
  );
}

// Crown: gray (none) → NEON blue (partial) → gold (complete)
function ChallengeCrown({ state }: { state: 'none' | 'partial' | 'complete' }) {
  if (state === 'complete') {
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

// Book: gray (none) → NEON blue (partial) → gold (complete)
function ReviewBook({ state }: { state: 'none' | 'partial' | 'complete' }) {
  if (state === 'complete') {
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
    marginVertical: 8,
    marginHorizontal: 32
  },

  /** ★ faint neon glow on active Challenge */
  activeChallengeGlow: {
    shadowColor: NEON_BLUE,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },

  circleBase: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
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
  subtitle: { fontWeight: '800', fontSize: 18 },
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

