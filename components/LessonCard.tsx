import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/theme/lessonTheme';
import DishWithWifi from './icons/DishWithWifi';
import AntennaWithWifi from './icons/AntennaWithWifi';

type Props = {
  kind: 'lesson' | 'review' | 'challenge';
  title: string;
  subtitle?: string;
  locked: boolean;
  receiveDone: boolean;
  sendDone: boolean;
  isActive: boolean; // receive available indicator from path
  canSend: boolean;  // send available indicator from path (used for "active" styling only)
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

// Neon only (no deep blue anywhere)
const NEON_BLUE = colors.blueNeon;

const CROWN_SIZE = 32;
const BOOK_SIZE = 28;
const CIRCLE_SIZE = 60;

type CircleState = { active: boolean; completed: boolean; locked: boolean };

/** Soft breathing halo (opacity-only) */
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
  }, [enabled, period, min, max, v]);
  return v;
}

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
  renderIcon?: (args: { size: number; color: string; state: CircleState }) => React.ReactNode;
}) {
  const isActiveOutline = state.active && !state.completed && !state.locked;
  const isUnlockedIdle = !state.locked && !state.completed && !state.active;

  const breath = useBreath(isActiveOutline);

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
    borderColor = NEON_BLUE + '66';
    iconColor = NEON_BLUE + '99';
  }

  const innerSize = CIRCLE_SIZE - 8;

  return (
    <Pressable
      disabled={state.locked}
      onPress={state.locked ? () => {} : onPress}
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
          style={[styles.glowRing, { borderColor: NEON_BLUE, opacity: breath }]}
        />
      )}

      <View
        style={{ width: innerSize, height: innerSize, alignItems: 'center', justifyContent: 'center' }}
        pointerEvents="none"
      >
        {renderIcon ? (
          renderIcon({ size: innerSize, color: iconColor, state })
        ) : iconName ? (
          <MaterialCommunityIcons
            name={iconName}
            size={Math.round(innerSize * 0.56)}
            color={iconColor}
            style={{ transform: [{ translateY: 1 }] }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

function toReceiveState(s: CircleState): 'active' | 'inactive' | 'completed' {
  if (s.completed) return 'completed';
  if (s.active) return 'active';
  return 'inactive';
}

function toSendState(s: CircleState): 'active' | 'inactive' | 'completed' {
  if (s.completed) return 'completed';
  if (s.active) return 'active';
  return 'inactive';
}

export default function LessonCard(p: Props) {
  const bothComplete = p.receiveDone && p.sendDone;

  // RECEIVE (left) — unlocked reviews/challenges can start immediately; lessons use isActive
  const left: CircleState = {
    active: !p.locked && !p.receiveDone && (p.isActive || p.kind === 'review' || p.kind === 'challenge'),
    completed: p.receiveDone,
    locked: p.locked,
  };

  // SEND (right)
  // - Active when this node is the first eligible to send (p.canSend) or its receive is already done
  // - Never lock completed sends; they should be tappable to replay
  const right: CircleState = {
    active: (p.receiveDone || p.canSend) && !p.sendDone && !p.locked,
    completed: p.sendDone,
    locked: p.locked || (!(p.receiveDone || p.canSend) && !p.sendDone),
  };

  // Card frame
  const anyActive = (left.active || right.active) && !bothComplete;
  const nodeLocked = p.locked;

  const cardBorder = bothComplete ? GOLD_OUTLINE : !nodeLocked ? NEON_BLUE : GRAY_BORDER;
  const cardBackground = bothComplete
    ? 'rgba(255, 215, 0, 0.08)'
    : !nodeLocked
    ? 'rgba(0, 229, 255, 0.08)'
    : CARD_BG;

  const subtitleColor = bothComplete ? GOLD_OUTLINE : !nodeLocked ? NEON_BLUE : MUTED_ICON;

  const badgeState: 'none' | 'partial' | 'complete' = bothComplete ? 'complete' : anyActive ? 'partial' : 'none';

  const label = p.subtitle ? `${p.title} ${p.subtitle}` : p.title;
  const visibleTitle = p.kind === 'review' ? 'Review' : p.kind === 'challenge' ? 'Challenge' : p.title;
  const visibleSubtitle = p.kind === 'lesson' ? p.subtitle : undefined;

  const activeChallengeGlow = p.kind === 'challenge' && p.isActive;

  return (
    <View
      style={[
        styles.card,
        { borderColor: cardBorder, backgroundColor: cardBackground },
        activeChallengeGlow && styles.activeChallengeGlow,
        p.style,
      ]}
      accessibilityLabel={label}
    >
      {/* LEFT: Receive */}
      <CircleButton
        state={left}
        onPress={p.onReceive}
        accessibilityLabel="Receive"
        renderIcon={({ size, state }) => (
          <DishWithWifi
            state={toReceiveState(state)}
            size={size}
            dishScale={0.5}
            wifiScale={1.02}
            style={{ transform: [{ translateY: 2 }, { translateX: 1 }] }}
            completedTint={GOLD_OUTLINE}
            inactiveTint={MUTED_ICON + 'AA'}
            wifi={{
              originX: 0.87,
              originY: 0.18,
              rotationDeg: 150,
              spanDeg: 105,
              baseRadius: size * 0.10,
              gap: size * 0.085,
              strokeWidth: 2,
              colorActive: NEON_BLUE,
              colorCompleted: GOLD_OUTLINE,
              offsetX: 0,
              offsetY: -0.5,
            }}
            imageStyle={{ transform: [{ translateX: -5 }, { translateY: 2 }] }}
          />
        )}
      />

      {/* CENTER */}
      <View style={styles.center}>
        <Text style={styles.title}>{visibleTitle}</Text>
        {!!visibleSubtitle && <Text style={[styles.subtitle, { color: subtitleColor }]}>{visibleSubtitle}</Text>}
        {p.kind === 'review' && <ReviewBook state={badgeState} nodeLocked={p.locked} />}
        {p.kind === 'challenge' && <ChallengeCrown state={badgeState} nodeLocked={p.locked} />}
      </View>

      {/* RIGHT: Send */}
      <CircleButton
        state={right}
        onPress={p.onSend}  // <-- always allow tapping unless truly locked
        accessibilityLabel="Send"
        renderIcon={({ size, state }) => (
          <AntennaWithWifi
            state={toSendState(state)}
            size={size}
            towerScale={0.6}
            wifiScale={1.0}
            style={{ transform: [{ translateY: 6 }] }}
            completedTint={GOLD_OUTLINE}
            inactiveTint={MUTED_ICON + 'AA'}
            rightWifi={{
              colorActive: NEON_BLUE,
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
              colorActive: NEON_BLUE,
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

// Crown: gray (locked) → NEON (unlocked but not complete) → gold (complete)
function ChallengeCrown({
  state,
  nodeLocked,
}: {
  state: 'none' | 'partial' | 'complete';
  nodeLocked: boolean;
}) {
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
  if (!nodeLocked) {
    return (
      <MaterialCommunityIcons
        name="crown"
        size={CROWN_SIZE}
        color={NEON_BLUE}
        accessibilityLabel="Challenge (available)"
      />
    );
  }
  return (
      <MaterialCommunityIcons
        name="crown-outline"
        size={CROWN_SIZE}
        color={GRAY_BORDER + 'AA'}
        accessibilityLabel="Challenge (locked)"
      />
  );
}

// Book: gray (locked) → NEON (unlocked but not complete) → gold (complete)
function ReviewBook({
  state,
  nodeLocked,
}: {
  state: 'none' | 'partial' | 'complete';
  nodeLocked: boolean;
}) {
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
  if (!nodeLocked) {
    return (
      <MaterialCommunityIcons
        name="book-open-variant"
        size={BOOK_SIZE}
        color={NEON_BLUE}
        accessibilityLabel="Review (available)"
      />
    );
  }
  return (
    <MaterialCommunityIcons
      name="book-open-variant"
      size={BOOK_SIZE}
      color={GRAY_BORDER + 'AA'}
      accessibilityLabel="Review (locked)"
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
    marginHorizontal: 32,
  },

  /** faint neon glow on active Challenge */
  activeChallengeGlow: Platform.select({
    ios: {
      shadowColor: NEON_BLUE,
      shadowOpacity: 0.35,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 0 },
      elevation: 8,
    },
    android: {},
  }) as any,

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
  crownMask: {
    width: CROWN_SIZE,
    height: CROWN_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  crownGradient: { flex: 1 },
  bookMask: {
    width: BOOK_SIZE,
    height: BOOK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  bookGradient: { flex: 1 },
});
