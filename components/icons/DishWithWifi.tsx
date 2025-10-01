// components/icons/DishWithWifi.tsx
import React from 'react';
import {
  View,
  Image,
  ImageStyle,
  StyleProp,
  ViewStyle,
  ImageSourcePropType,
  StyleSheet,
} from 'react-native';
import WifiOverlay, { WifiOverlayProps } from './WifiOverlay';

type Props = {
  state: 'active' | 'inactive' | 'completed';

  /** Square dimension for the whole icon (container + overlay baseline). */
  size?: number;

  /** Container style (positioning, transforms, margins, etc.). */
  style?: StyleProp<ViewStyle>;

  /** Extra styles for the dish <Image> only. */
  imageStyle?: StyleProp<ImageStyle>;

  /**
   * Pass-through settings to control the WifiOverlay geometry/animation.
   * (We omit 'mode' and 'size' so this component controls them.)
   */
  wifi?: Partial<Omit<WifiOverlayProps, 'mode' | 'size'>>;

  // Image assets (defaults to your included PNGs)
  srcColor?: ImageSourcePropType;
  srcOutline?: ImageSourcePropType;

  // Tints (applied to the dish image if you’re using a mono/outline variant)
  inactiveTint?: string;
  activeTint?: string;
  completedTint?: string;

  /** Flip the dish horizontally (waves orientation unaffected). */
  flipX?: boolean;

  /** Scale factor (0.0–1.0+) for the dish image, independent of wifi arcs. */
  dishScale?: number;

  /** Scale factor (0.0–1.0+) for the wifi overlay, independent of dish. */
  wifiScale?: number;
};

const DishWithWifi: React.FC<Props> = ({
  state,
  size = 64,
  style,
  imageStyle,
  wifi,
  srcColor = require('@/assets/icons/satellite-dish_color_no_outline.png'),
  srcOutline = require('@/assets/icons/satellite-dish_outline.png'),
  inactiveTint = '#9AA0A6',
  activeTint = undefined,
  completedTint = undefined,
  flipX = false,
  dishScale = 1,
  wifiScale = 1,
}) => {
  const mode =
    state === 'active' ? 'active' : state === 'completed' ? 'completed' : 'inactive';

  const dishSource = state === 'active' ? srcColor : srcOutline;

  const tintColor =
    state === 'inactive'
      ? inactiveTint
      : state === 'active'
      ? activeTint
      : completedTint;

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      {/* Wifi waves (independently scaled & centered by WifiOverlay container) */}
      <WifiOverlay
        mode={mode}
        size={size * wifiScale}
        originX={wifi?.originX ?? 0.68}
        originY={wifi?.originY ?? 0.30}
        rotationDeg={wifi?.rotationDeg ?? -35}
        spanDeg={wifi?.spanDeg ?? 95}
        baseRadius={wifi?.baseRadius}
        gap={wifi?.gap}
        strokeWidth={wifi?.strokeWidth}
        colorActive={wifi?.colorActive}
        colorCompleted={wifi?.colorCompleted}
        colorInactive={wifi?.colorInactive}
        opacityInactive={wifi?.opacityInactive}
        periodMs={wifi?.periodMs}
        staggerMs={wifi?.staggerMs}
        offsetX={wifi?.offsetX}
        offsetY={wifi?.offsetY}
        style={wifi?.style}
      />

      {/* Dish image (independently scaled) */}
      <Image
        source={dishSource}
        resizeMode="contain"
        style={[
          { width: size * dishScale, height: size * dishScale },
          flipX ? { transform: [{ scaleX: -1 }] } : null,
          tintColor ? { tintColor } : null,
          imageStyle,
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative', // anchors WifiOverlay (absolute) to this box
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DishWithWifi;
