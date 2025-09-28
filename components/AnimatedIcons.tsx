// components/AnimatedIcons.tsx
/**
 * Animated send/receive icons for lesson cards.
 * ------------------------------------------------------
 * - Send: Antenna with waves expanding outward
 * - Receive: Radar dish with waves moving inward
 *
 * Behavior:
 * - Active → animated looping waves
 * - Completed/Inactive → static faint outline
 * - Colors: Neon cyan for send, golden yellow for receive
 * - Stroke: Slightly thicker for crispness
 * - Easing: Smooth quad-out easing for natural motion
 */

import React from 'react';
import Svg, { Circle, Line, Path, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withDelay,
  cancelAnimation,
  Easing,
  SharedValue, // <- correct type import
} from 'react-native-reanimated';

type IconProps = {
  active?: boolean;
  size?: number;
  color?: string;
  periodMs?: number;
};

const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);

/** Shared pulse progress 0↔1 with stagger support */
function usePulse(
  active: boolean,
  delayMs: number,
  periodMs: number,
  from = 0,
  to = 1
) {
  const v = useSharedValue(from);
  React.useEffect(() => {
    cancelAnimation(v);
    if (active) {
      v.value = withDelay(
        delayMs,
        withRepeat(
          withTiming(to, {
            duration: periodMs,
            easing: Easing.out(Easing.quad),
          }),
          -1,
          true
        )
      );
    } else {
      v.value = withTiming(from, { duration: 150 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, delayMs, periodMs]);
  return v;
}

/** Hook for animated circle ring props (radius + opacity) */
function useRingProps(
  p: SharedValue<number>,
  mul: number,
  rBase: number,
  s: number
) {
  return useAnimatedProps(() => ({
    r: rBase + (s * 0.18 * mul) * p.value,
    opacity: 0.9 - 0.9 * p.value,
  }));
}

/** Hook for animated wave path props (path d + opacity) */
function useWaveProps(
  p: SharedValue<number>,
  amp: number,
  dishX: number,
  dishY: number,
  s: number
) {
  return useAnimatedProps(() => {
    const offset = (1 - p.value) * s * 0.18;
    const path = `M ${s * 0.12 + offset} ${dishY - amp} Q ${s * 0.4 + offset} ${
      dishY - amp * 1.4
    }, ${dishX - s * 0.08 + offset} ${dishY - amp * 1.2}`;
    return { d: path, opacity: 0.2 + 0.8 * p.value };
  });
}

/** SEND: Antenna with outward waves */
export function SendIcon({
  active = false,
  size = 44,
  color = '#00E5FF', // neon cyan
  periodMs = 1200,
}: IconProps) {
  const s = size;
  const cx = s * 0.5;
  const cy = s * 0.62;

  // staggered pulses
  const p1 = usePulse(active, 0, periodMs);
  const p2 = usePulse(active, periodMs * 0.25, periodMs);
  const p3 = usePulse(active, periodMs * 0.5, periodMs);

  const rBase = s * 0.14;

  const rp1 = useRingProps(p1, 1, rBase, s);
  const rp2 = useRingProps(p2, 1.6, rBase, s);
  const rp3 = useRingProps(p3, 2.2, rBase, s);

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      {/* Antenna */}
      <Line x1={cx} y1={cy} x2={cx} y2={s * 0.2} stroke={color} strokeWidth={2.5} />
      <Circle cx={cx} cy={cy} r={s * 0.045} fill={color} />
      <Line
        x1={cx - s * 0.08}
        y1={cy}
        x2={cx + s * 0.08}
        y2={cy}
        stroke={color}
        strokeWidth={2.5}
      />
      {/* Base */}
      <Path
        d={`M ${cx - s * 0.14} ${cy + s * 0.02} L ${cx + s * 0.14} ${
          cy + s * 0.02
        } L ${cx} ${cy + s * 0.2} Z`}
        fill={color}
        opacity={0.6}
      />
      {/* Waves */}
      {active ? (
        <>
          <ACircle
            cx={cx}
            cy={cy}
            stroke={color}
            strokeWidth={2.5}
            fill="none"
            animatedProps={rp1}
          />
          <ACircle
            cx={cx}
            cy={cy}
            stroke={color}
            strokeWidth={2.5}
            fill="none"
            animatedProps={rp2}
          />
          <ACircle
            cx={cx}
            cy={cy}
            stroke={color}
            strokeWidth={2.5}
            fill="none"
            animatedProps={rp3}
          />
        </>
      ) : (
        <Circle
          cx={cx}
          cy={cy}
          r={rBase * 1.6}
          stroke={color}
          strokeWidth={2.5}
          fill="none"
          opacity={0.3}
        />
      )}
    </Svg>
  );
}

/** RECEIVE: Radar dish with inward waves */
export function ReceiveIcon({
  active = false,
  size = 44,
  color = '#FFD54F', // golden yellow
  periodMs = 1200,
}: IconProps) {
  const s = size;
  const dishX = s * 0.68;
  const dishY = s * 0.6;

  const prog1 = usePulse(active, 0, periodMs);
  const prog2 = usePulse(active, periodMs * 0.25, periodMs);
  const prog3 = usePulse(active, periodMs * 0.5, periodMs);

  const ap1 = useWaveProps(prog1, 0, dishX, dishY, s);
  const ap2 = useWaveProps(prog2, s * 0.08, dishX, dishY, s);
  const ap3 = useWaveProps(prog3, s * 0.16, dishX, dishY, s);

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      {/* Waves */}
      {active ? (
        <>
          <APath stroke={color} strokeWidth={2.5} fill="none" animatedProps={ap1} />
          <APath stroke={color} strokeWidth={2.5} fill="none" animatedProps={ap2} />
          <APath stroke={color} strokeWidth={2.5} fill="none" animatedProps={ap3} />
        </>
      ) : (
        <Path
          d={`M ${s * 0.12} ${dishY} Q ${s * 0.4} ${dishY}, ${dishX - s * 0.08} ${dishY}`}
          stroke={color}
          strokeWidth={2.5}
          fill="none"
          opacity={0.3}
        />
      )}

      {/* Dish */}
      <G rotation={-25} origin={`${dishX}, ${dishY}`}>
        <Path
          d={`
            M ${dishX - s * 0.16} ${dishY}
            A ${s * 0.18} ${s * 0.18} 0 0 1 ${dishX} ${dishY - s * 0.12}
          `}
          stroke={color}
          strokeWidth={2.5}
          fill="none"
        />
        <Circle cx={dishX - s * 0.02} cy={dishY - s * 0.06} r={s * 0.015} fill={color} />
      </G>

      {/* Base */}
      <Path
        d={`M ${dishX - s * 0.06} ${dishY + s * 0.02} L ${dishX + s * 0.02} ${
          dishY + s * 0.18
        } L ${dishX - s * 0.12} ${dishY + s * 0.18} Z`}
        fill={color}
        opacity={0.6}
      />
    </Svg>
  );
}