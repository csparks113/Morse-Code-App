import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import type { Animated } from 'react-native';

import { theme } from '@/theme/theme';

import FlashOverlay from './FlashOverlay';

export const FLASH_OVERLAY_HOST_NATIVE_ID = 'flash-overlay-background';

type FlashOverlayHostProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  backgroundNativeID?: string;
  fallbackOpacity?: Animated.Value | null;
  fallbackMaxOpacity?: number;
  fallbackColor?: string;
};

// Default background aligns with the theme so the native overlay brightens the intended surface.
const DEFAULT_BACKGROUND_COLOR = theme.colors.background;

function FlashOverlayHost({
  children,
  style,
  contentStyle,
  backgroundColor = DEFAULT_BACKGROUND_COLOR,
  backgroundNativeID,
  fallbackOpacity,
  fallbackMaxOpacity,
  fallbackColor,
}: FlashOverlayHostProps) {
  const overlayNativeID = backgroundNativeID ?? FLASH_OVERLAY_HOST_NATIVE_ID;
  const shouldRenderFallback = Boolean(fallbackOpacity);

  return (
    <View style={[styles.root, style]} pointerEvents="box-none">
      <View
        pointerEvents="none"
        nativeID={overlayNativeID}
        style={[StyleSheet.absoluteFillObject, styles.background, { backgroundColor }]}
      >
        {shouldRenderFallback && fallbackOpacity ? (
          <FlashOverlay
            opacity={fallbackOpacity}
            maxOpacity={fallbackMaxOpacity}
            color={fallbackColor}
          />
        ) : null}
      </View>
      <View style={[styles.content, contentStyle]} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    position: 'relative',
  },
  background: {
    zIndex: 0,
  },
  content: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
  },
});

export default FlashOverlayHost;
