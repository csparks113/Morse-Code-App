import React from "react";
import { Animated, StyleSheet, StyleProp, ViewStyle } from "react-native";

import { theme } from "@/theme/theme";

type FlashOverlayProps = {
  opacity: Animated.Value;
  maxOpacity?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

function FlashOverlay({
  opacity,
  maxOpacity = 0.28,
  color = theme.colors.textPrimary,
  style,
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
        style,
        { backgroundColor: color, opacity: animatedOpacity },
      ]}
    />
  );
}

export default FlashOverlay;
