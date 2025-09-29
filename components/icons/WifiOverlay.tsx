// components/icons/WifiOverlay.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  withTiming,
  withRepeat,
  cancelAnimation,
  useAnimatedProps,
  Easing,
} from 'react-native-reanimated';

const APath = Animated.createAnimatedComponent(Path);

export type WifiOverlayProps = {
  /** Total square size of the overlay (width = height = size). */
  size?: number;

  /** Anchor point for the arc center, as a fraction of size (0..1). */
  originX?: number; // default 0.68 (over the dish’s feedhorn)
  originY?: number; // default 0.30

  /** Rotate the arc group in degrees. */
  rotationDeg?: number; // default -35 (tilts toward upper-right)

  /** Inner radius and spacing between arcs. */
  baseRadius?: number;
  gap?: number;

  /** Angular span for each arc. */
  spanDeg?: number;

  /** Stroke details. */
  strokeWidth?: number;
  colorActive?: string;
  colorCompleted?: string;
  /** Color for inactive/gray state. */
  colorInactive?: string;
  opacityInactive?: number;

  /** State of the signal. */
  mode: 'active' | 'completed' | 'inactive';

  /** Animation timing (whole cycle length). */
  periodMs?: number;

  /** Optional style for the absolute container (zIndex, etc.). */
  style?: any;

  /** Optional pixel offsets to nudge the whole overlay relative to its center. */
  offsetX?: number;
  offsetY?: number;
};

/* ---------------- Helpers ---------------- */

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number
) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const sa = toRad(startDeg);
  const ea = toRad(endDeg);
  const x1 = cx + r * Math.cos(sa);
  const y1 = cy + r * Math.sin(sa);
  const x2 = cx + r * Math.cos(ea);
  const y2 = cy + r * Math.sin(ea);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

/** One looping progress value 0→1; use to compute three opacities. */
function useLoopProgress(enabled: boolean, periodMs: number) {
  const p = useSharedValue(0);
  React.useEffect(() => {
    cancelAnimation(p);
    if (enabled) {
      p.value = 0;
      p.value = withRepeat(
        withTiming(1, { duration: periodMs, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      p.value = 0;
    }
    return () => cancelAnimation(p);
  }, [enabled, periodMs, p]);
  return p;
}

/** Build animated opacity props from a function of progress. */
function useOpacityFromProgress(
  progress: Animated.SharedValue<number>,
  compute: (t: number) => number
) {
  return useAnimatedProps(() => {
    'worklet';
    const t = progress.value;

    // Small easing helpers (worklet-safe)
    const clamp = (x: number, a: number, b: number) =>
      Math.max(a, Math.min(b, x));
    const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

    // Compute and smooth
    const raw = compute(t);
    const eased = easeOutCubic(clamp(raw, 0, 1));
    return { opacity: eased };
  });
}

/* --------------- Component ---------------- */

const WifiOverlay: React.FC<WifiOverlayProps> = ({
  size = 64,
  originX = 0.68,
  originY = 0.30,
  rotationDeg = -35,
  baseRadius,
  gap,
  spanDeg = 95,
  strokeWidth = 2.5,
  colorActive = '#35C6FF',
  colorCompleted = '#5AE08A',
  colorInactive = '#3E424B',
  opacityInactive = 0.28,
  mode,
  periodMs = 1200,
  style,
  offsetX = 0,
  offsetY = 0,
}) => {
  const s = size;
  const cx = s * originX;
  const cy = s * originY;
  const r0 = baseRadius ?? s * 0.10;
  const g  = gap ?? s * 0.07;

  // Geometry
  const start = -spanDeg / 2;
  const end   =  spanDeg / 2;
  const d1 = arcPath(cx, cy, r0,           start, end);      // small
  const d2 = arcPath(cx, cy, r0 + g,       start, end);      // medium
  const d3 = arcPath(cx, cy, r0 + g * 2.0, start, end);      // large

  // Animation spec: S→M→L (fade-ins), then ALL fade out together.
  // Stages: [0, .25) small in; [.25, .5) medium in; [.5, .75) large in; [.75, 1) all out
  const p = useLoopProgress(mode === 'active', periodMs);

  const opSmall = useOpacityFromProgress(p, (t) => {
    'worklet';
    if (t < 0.25) return t / 0.25;          // 0 → 1
    if (t < 0.75) return 1;                 // hold
    return 1 - (t - 0.75) / 0.25;           // 1 → 0 together
  });

  const opMedium = useOpacityFromProgress(p, (t) => {
    'worklet';
    if (t < 0.25) return 0;
    if (t < 0.50) return (t - 0.25) / 0.25; // 0 → 1
    if (t < 0.75) return 1;                 // hold
    return 1 - (t - 0.75) / 0.25;           // 1 → 0 together
  });

  const opLarge = useOpacityFromProgress(p, (t) => {
    'worklet';
    if (t < 0.50) return 0;
    if (t < 0.75) return (t - 0.50) / 0.25; // 0 → 1
    return 1 - (t - 0.75) / 0.25;           // 1 → 0 together
  });

  const isStatic = mode !== 'active';
  const staticColor = mode === 'inactive' ? colorInactive : colorCompleted;
  const staticOpacity = mode === 'inactive' ? opacityInactive : 0.95;

  return (
    <View pointerEvents="none" style={[styles.container, style]}>
      <View style={{ transform: [{ translateX: offsetX }, { translateY: offsetY }] }}>
        <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <G origin={`${cx}, ${cy}`} rotation={rotationDeg}>
            {isStatic ? (
              <>
                <Path d={d1} stroke={staticColor} strokeWidth={strokeWidth} fill="none" opacity={staticOpacity} />
                <Path d={d2} stroke={staticColor} strokeWidth={strokeWidth} fill="none" opacity={staticOpacity} />
                <Path d={d3} stroke={staticColor} strokeWidth={strokeWidth} fill="none" opacity={staticOpacity} />
              </>
            ) : (
              <>
                <APath d={d1} stroke={colorActive} strokeWidth={strokeWidth} fill="none" animatedProps={opSmall} />
                <APath d={d2} stroke={colorActive} strokeWidth={strokeWidth} fill="none" animatedProps={opMedium} />
                <APath d={d3} stroke={colorActive} strokeWidth={strokeWidth} fill="none" animatedProps={opLarge} />
              </>
            )}
          </G>
        </Svg>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // centered absolute-fill so scaled SVG stays aligned over the dish
  container: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default WifiOverlay;
