import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Animated } from 'react-native';

import { theme } from '@/theme/theme';

import FlashOverlay from './FlashOverlay';

export const FLASH_OVERLAY_HOST_NATIVE_ID = 'flash-overlay-background';

type FlashOverlayHostProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  backgroundNativeID?: string;
  fallbackIntensity?: Animated.Value | null;
  fallbackBrightnessPercent?: number;
  fallbackTintColor?: string;
};

// Default background aligns with the theme so the native overlay brightens the intended surface.
const DEFAULT_BACKGROUND_COLOR = theme.colors.background;
const DEFAULT_FALLBACK_TINT = '#FFFFFF';

function FlashOverlayHost({
  children,
  style,
  contentStyle,
  backgroundColor = DEFAULT_BACKGROUND_COLOR,
  backgroundNativeID,
  fallbackIntensity,
  fallbackBrightnessPercent,
  fallbackTintColor = DEFAULT_FALLBACK_TINT,
}: FlashOverlayHostProps) {
  const overlayNativeID = backgroundNativeID ?? FLASH_OVERLAY_HOST_NATIVE_ID;
  const shouldRenderFallback =
    fallbackIntensity != null && fallbackBrightnessPercent != null;

  return (
    <View style={[styles.root, style]} pointerEvents="box-none">
      <View
        pointerEvents="none"
        nativeID={overlayNativeID}
        style={[StyleSheet.absoluteFillObject, styles.background, { backgroundColor }]}
      >
        {shouldRenderFallback && fallbackIntensity ? (
          <FlashOverlay
            intensity={fallbackIntensity}
            tintColor={fallbackTintColor}
            brightnessPercent={fallbackBrightnessPercent ?? 0}
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
