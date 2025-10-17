import React from 'react';
import { Animated, StyleSheet, StyleProp, ViewStyle } from 'react-native';

type FlashOverlayProps = {
  intensity: Animated.Value;
  tintColor: string;
  brightnessPercent: number;
  style?: StyleProp<ViewStyle>;
  zIndex?: number;
  elevation?: number;
};

const BRIGHTNESS_PERCENT_FLOOR = 25;
const BRIGHTNESS_PERCENT_CEIL = 100;
const BRIGHTNESS_SCALAR_MIN = 0.25;
const BRIGHTNESS_SCALAR_MAX = 1.0;
const BRIGHTNESS_RESPONSE_GAMMA = 0.45;

const clampPercent = (value: number) =>
  Math.max(BRIGHTNESS_PERCENT_FLOOR, Math.min(BRIGHTNESS_PERCENT_CEIL, Math.round(value)));

const brightnessPercentToScalar = (percent: number) => {
  const clamped = clampPercent(Number.isFinite(percent) ? percent : BRIGHTNESS_PERCENT_FLOOR);
  const slider = Math.max(0, Math.min(1, clamped / 100));
  const curved = Math.pow(slider, BRIGHTNESS_RESPONSE_GAMMA);
  return BRIGHTNESS_SCALAR_MIN + (BRIGHTNESS_SCALAR_MAX - BRIGHTNESS_SCALAR_MIN) * curved;
};

function FlashOverlay({
  intensity,
  tintColor,
  brightnessPercent,
  style,
  zIndex = 0,
  elevation = 0,
}: FlashOverlayProps) {
  const brightnessScalar = React.useMemo(
    () => brightnessPercentToScalar(brightnessPercent),
    [brightnessPercent],
  );

  const animatedOpacity = React.useMemo(
    () =>
      intensity.interpolate({
        inputRange: [0, 1],
        outputRange: [0, brightnessScalar],
      }),
    [intensity, brightnessScalar],
  );

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          backgroundColor: tintColor,
          opacity: animatedOpacity,
          zIndex,
          elevation,
        },
        style,
      ]}
    />
  );
}

export default FlashOverlay;
