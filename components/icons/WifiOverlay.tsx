// components/icons/WifiOverlay.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  withTiming,
  withRepeat,
  useAnimatedProps,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

const APath = Animated.createAnimatedComponent(Path);

export type WifiOverlayProps = {
  size?: number;
  originX?: number;
  originY?: number;
  rotationDeg?: number;
  baseRadius?: number;
  gap?: number;
  spanDeg?: number;
  strokeWidth?: number;
  colorActive?: string;
  colorCompleted?: string;
  opacityInactive?: number;
  mode: 'active' | 'completed' | 'inactive';
  periodMs?: number;  // full 4-step cycle
  staggerMs?: number; // unused (kept for compat)
  style?: any;
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

// ---- 4-step sequencer ----
// 0: small
// 1: small + medium
// 2: small + medium + large
// 3: all off
function useSequence(mode: 'active' | 'completed' | 'inactive', periodMs: number) {
  const phase = useSharedValue(0); // 0..4 looping

  React.useEffect(() => {
    cancelAnimation(phase);
    if (mode === 'active') {
      phase.value = 0;
      phase.value = withRepeat(
        withTiming(4, { duration: periodMs, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      phase.value = 0;
    }
    return () => cancelAnimation(phase);
  }, [mode, periodMs]);

  const makeStepsOpacity = (steps: number[]) =>
    useAnimatedProps(() => {
      const k = Math.floor((phase.value % 4) + 1e-6); // 0..3
      return { opacity: steps.includes(k) ? 1 : 0 };
    });

  return {
    opSmall: makeStepsOpacity([0, 1, 2]),
    opMed:   makeStepsOpacity([1, 2]),
    opLarge: makeStepsOpacity([2]),
  };
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
  periodMs = 1200, // full 4-step loop
  staggerMs,       // unused in this sequence
  style,
  offsetX = 0,
  offsetY = 0,
}) => {
  const s = size;
  const cx = s * originX;
  const cy = s * originY;
  const r0 = baseRadius ?? s * 0.10;
  const g  = gap ?? s * 0.07;

  const { opSmall, opMed, opLarge } = useSequence(mode, periodMs);

  const start = -spanDeg / 2;
  const end   =  spanDeg / 2;

  const d1 = arcPath(cx, cy, r0,           start, end);        // small
  const d2 = arcPath(cx, cy, r0 + g,       start, end);        // medium
  const d3 = arcPath(cx, cy, r0 + g * 2.0, start, end);        // large

  const staticOpacity = mode === 'inactive' ? opacityInactive : 0.95;

  return (
    <View pointerEvents="none" style={[styles.container, style]}>
      <View style={{ transform: [{ translateX: offsetX }, { translateY: offsetY }] }}>
        <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
          <G origin={`${cx}, ${cy}`} rotation={rotationDeg}>
            {mode === 'active' ? (
              <>
                <APath d={d1} stroke={colorActive} strokeWidth={strokeWidth} fill="none" animatedProps={opSmall} />
                <APath d={d2} stroke={colorActive} strokeWidth={strokeWidth} fill="none" animatedProps={opMed} />
                <APath d={d3} stroke={colorActive} strokeWidth={strokeWidth} fill="none" animatedProps={opLarge} />
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
  container: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0, left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default WifiOverlay;
