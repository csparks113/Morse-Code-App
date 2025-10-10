import React from 'react';
import { Animated, StyleSheet, StyleProp, ViewStyle } from 'react-native';

import { theme } from '@/theme/theme';

type FlashOverlayProps = {
  opacity: Animated.Value;
  maxOpacity?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  zIndex?: number;
  elevation?: number;
};

function FlashOverlay({
  opacity,
  maxOpacity = 0.28,
  color = theme.colors.textPrimary,
  style,
  zIndex = 0,
  elevation = 0,
}: FlashOverlayProps) {
  const animatedOpacity = React.useMemo(
    () =>
      opacity.interpolate({
        inputRange: [0, 1],
        outputRange: [0, maxOpacity],
      }),
    [opacity, maxOpacity],
  );

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          backgroundColor: color,
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
