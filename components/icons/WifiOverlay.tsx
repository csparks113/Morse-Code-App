// components/icons/WifiOverlay.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  withTiming,
  withRepeat,
  withDelay,
  useAnimatedProps,
  cancelAnimation,
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
  opacityInactive?: number;

  /** State of the signal. */
  mode: 'active' | 'completed' | 'inactive';

  /** Animation timing. */
  periodMs?: number;
  staggerMs?: number;

  /** Optional style for the absolute container (zIndex, etc.). */
  style?: any;

  /** Optional pixel offsets to nudge the whole overlay relative to its center. */
  offsetX?: number;
  offsetY?: number;
};

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
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

function useBlink(active: boolean, delay: number, periodMs: number) {
  const v = useSharedValue(0);
  React.useEffect(() => {
    cancelAnimation(v);
    if (active) {
      v.value = withDelay(
        delay,
        withRepeat(withTiming(1, { duration: periodMs, easing: Easing.out(Easing.cubic) }), -1, false)
      );
    } else {
      v.value = withTiming(0, { duration: 120 });
    }
    return () => cancelAnimation(v);
  }, [active, delay, periodMs]);
  return v;
}

function useOpacityProps(v: Animated.SharedValue<number>) {
  return useAnimatedProps(() => ({ opacity: v.value }));
}

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
  opacityInactive = 0.25,
  mode,
  periodMs = 1100,
  staggerMs = 220,
  style,
  offsetX = 0,
  offsetY = 0,
}) => {
  const s = size;
  const cx = s * originX;
  const cy = s * originY;
  const r0 = baseRadius ?? s * 0.10;
  const g  = gap ?? s * 0.07;

  const v1 = useBlink(mode === 'active', 0, periodMs);
  const v2 = useBlink(mode === 'active', staggerMs, periodMs);
  const v3 = useBlink(mode === 'active', staggerMs * 2, periodMs);

  const op1 = useOpacityProps(v1);
  const op2 = useOpacityProps(v2);
  const op3 = useOpacityProps(v3);

  const start = -spanDeg / 2;
  const end   =  spanDeg / 2;

  const d1 = arcPath(cx, cy, r0,           start, end);
  const d2 = arcPath(cx, cy, r0 + g,       start, end);
  const d3 = arcPath(cx, cy, r0 + g * 2.0, start, end);

  const staticOpacity = mode === 'inactive' ? opacityInactive : 0.95;

  return (
    <View pointerEvents="none" style={[styles.container, style]}>
      <View style={{ transform: [{ translateX: offsetX }, { translateY: offsetY }] }}>
        <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <G origin={`${cx}, ${cy}`} rotation={rotationDeg}>
            {mode === 'active' ? (
              <>
                <APath d={d1} stroke={colorActive} strokeWidth={strokeWidth} fill="none" animatedProps={op1} />
                <APath d={d2} stroke={colorActive} strokeWidth={strokeWidth} fill="none" animatedProps={op2} />
                <APath d={d3} stroke={colorActive} strokeWidth={strokeWidth} fill="none" animatedProps={op3} />
              </>
            ) : (
              <>
                <Path d={d1} stroke={colorCompleted} strokeWidth={strokeWidth} fill="none" opacity={staticOpacity} />
                <Path d={d2} stroke={colorCompleted} strokeWidth={strokeWidth} fill="none" opacity={staticOpacity} />
                <Path d={d3} stroke={colorCompleted} strokeWidth={strokeWidth} fill="none" opacity={staticOpacity} />
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

