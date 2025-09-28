// components/icons/AntennaWithWifi.tsx
import React from 'react';
import {
  View,
  Image,
  ImageStyle,
  ImageSourcePropType,
  StyleProp,
  ViewStyle,
  StyleSheet,
} from 'react-native';
import WifiOverlay, { WifiOverlayProps } from './WifiOverlay';

type Props = {
  state: 'active' | 'inactive' | 'completed';

  /** Overall square size of the container. */
  size?: number;

  /** Container and image styling. */
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;

  /** Independent scaling. */
  towerScale?: number; // scale the antenna image
  wifiScale?: number;  // scale both Wi-Fi overlays

  /** Per-side Wi-Fi overrides (minus mode/size which are controlled here). */
  leftWifi?: Partial<Omit<WifiOverlayProps, 'mode' | 'size'>>;
  rightWifi?: Partial<Omit<WifiOverlayProps, 'mode' | 'size'>>;

  /** Assets */
  srcActive?: ImageSourcePropType;   // colored (gray tower + red tip)
  srcOutline?: ImageSourcePropType;  // white, tintable outline (solid tower + hollow ring)

  /** Tints for outline image (completed/inactive). */
  completedTint?: string;
  inactiveTint?: string;
};

const AntennaWithWifi: React.FC<Props> = ({
  state,
  size = 64,
  style,
  imageStyle,
  towerScale = 0.9,
  wifiScale = 1,
  leftWifi,
  rightWifi,
  // NOTE: adjust these requires to match your filenames/paths
  srcActive = require('@/assets/icons/antenna_color.png'),
  srcOutline = require('@/assets/icons/antenna_outline.png'),
  completedTint = '#F5C84C',
  inactiveTint = '#3E424B',
}) => {
  const showWifi = state !== 'inactive';
  const wifiMode: 'active' | 'completed' = state === 'active' ? 'active' : 'completed';
  const antennaSource = state === 'active' ? srcActive : srcOutline;
  const outlineTint = state === 'completed' ? completedTint : inactiveTint;

  return (
    <View style={[styles.box, { width: size, height: size }, style]}>
      {showWifi && (
        <>
          {/* Right-side waves (pointing outward) */}
          <WifiOverlay
            mode={wifiMode}
            size={size * wifiScale}
            originX={rightWifi?.originX ?? 0.72}
            originY={rightWifi?.originY ?? 0.18}
            rotationDeg={rightWifi?.rotationDeg ?? 0}
            spanDeg={rightWifi?.spanDeg ?? 105}
            baseRadius={rightWifi?.baseRadius ?? size * 0.10}
            gap={rightWifi?.gap ?? size * 0.085}
            strokeWidth={rightWifi?.strokeWidth ?? 2}
            colorActive={rightWifi?.colorActive ?? '#00E5FF'}
            colorCompleted={rightWifi?.colorCompleted ?? completedTint}
            opacityInactive={rightWifi?.opacityInactive}
            periodMs={rightWifi?.periodMs}
            staggerMs={rightWifi?.staggerMs}
            offsetX={rightWifi?.offsetX ?? 0}
            offsetY={rightWifi?.offsetY ?? -0.5}
            style={(rightWifi?.style) as any}
          />

          {/* Left-side waves (mirror) */}
          <WifiOverlay
            mode={wifiMode}
            size={size * wifiScale}
            originX={leftWifi?.originX ?? 0.28}
            originY={leftWifi?.originY ?? 0.18}
            rotationDeg={leftWifi?.rotationDeg ?? 180}
            spanDeg={leftWifi?.spanDeg ?? 105}
            baseRadius={leftWifi?.baseRadius ?? size * 0.10}
            gap={leftWifi?.gap ?? size * 0.085}
            strokeWidth={leftWifi?.strokeWidth ?? 2}
            colorActive={leftWifi?.colorActive ?? '#00E5FF'}
            colorCompleted={leftWifi?.colorCompleted ?? completedTint}
            opacityInactive={leftWifi?.opacityInactive}
            periodMs={leftWifi?.periodMs}
            staggerMs={leftWifi?.staggerMs}
            offsetX={leftWifi?.offsetX ?? 0}
            offsetY={leftWifi?.offsetY ?? -0.5}
            style={leftWifi?.style}
          />
        </>
      )}

      {/* Antenna image (colored for active, tintable outline for others) */}
      <Image
        source={antennaSource}
        resizeMode="contain"
        style={[
          { width: size * towerScale, height: size * towerScale },
          state === 'active' ? null : { tintColor: outlineTint },
          imageStyle,
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AntennaWithWifi;
