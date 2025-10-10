import React from "react";
import { StyleSheet, StyleProp, Text, View, ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

import { colors, spacing, surfaces, sessionControlTheme } from "@/theme/lessonTheme";

type KeyerButtonProps = {
  onPressIn?: (timestampMs?: number) => void;
  onPressOut?: (timestampMs?: number) => void;
  disabled?: boolean;
  minHeight?: number;
  label?: string;
  style?: StyleProp<ViewStyle>;
  releaseSignal?: number;
};

const DEFAULT_LABEL = "Tap & Hold to Key";
const keyerButtonTheme = sessionControlTheme.keyerButton;
function KeyerButton({
  onPressIn,
  onPressOut,
  disabled = false,
  minHeight,
  label = DEFAULT_LABEL,
  style,
  releaseSignal,
}: KeyerButtonProps) {
  const [pressed, setPressed] = React.useState(false);
  const activeRef = React.useRef(false);
  const releaseRef = React.useRef(releaseSignal);

  const handleDown = React.useCallback(
    (timestamp?: number) => {
      if (disabled || activeRef.current) {
        return;
      }
      activeRef.current = true;
      setPressed(true);
      onPressIn?.(timestamp);
    },
    [disabled, onPressIn],
  );

  const handleUp = React.useCallback(
    (timestamp?: number) => {
      if (!activeRef.current) {
        return;
      }
      activeRef.current = false;
      setPressed(false);
      onPressOut?.(timestamp);
    },
    [onPressOut],
  );

  const handleCancel = React.useCallback(() => {
    if (!activeRef.current) {
      return;
    }
    activeRef.current = false;
    setPressed(false);
    onPressOut?.();
  }, [onPressOut]);

  React.useEffect(() => {
    if (releaseRef.current === releaseSignal) {
      return;
    }
    releaseRef.current = releaseSignal;
    if (!activeRef.current && !pressed) {
      return;
    }
    activeRef.current = false;
    setPressed(false);
    onPressOut?.();
  }, [releaseSignal, onPressOut, pressed]);

  const extractTimestamp = React.useCallback((event: any): number | undefined => {
    const changed = event?.changedTouches?.[0];
    if (changed?.timestamp != null) {
      return changed.timestamp;
    }
    const first = event?.allTouches?.[0];
    if (first?.timestamp != null) {
      return first.timestamp;
    }
    return typeof event?.timestamp === 'number' ? event.timestamp : undefined;
  }, []);

  const gesture = React.useMemo(() => {
    const pan = Gesture.Pan()
      .maxPointers(1)
      .minDistance(0)
      .runOnJS(true)
      .onTouchesDown((event) => {
        if (disabled) return;
        const ts = extractTimestamp(event);
        runOnJS(handleDown)(ts);
      })
      .onTouchesUp((event) => {
        if (disabled) return;
        const ts = extractTimestamp(event);
        runOnJS(handleUp)(ts);
      })
      .onFinalize((event) => {
        if (disabled) return;
        const ts = extractTimestamp(event);
        if (ts != null) {
          runOnJS(handleUp)(ts);
        } else {
          runOnJS(handleCancel)();
        }
      });
    return disabled ? pan.enabled(false) : pan;
  }, [disabled, extractTimestamp, handleCancel, handleDown, handleUp]);

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessibilityRole="button"
        accessible
        pointerEvents={disabled ? 'none' : 'auto'}
        style={[
          styles.base,
          minHeight != null ? { minHeight } : null,
          style,
          pressed ? styles.pressed : null,
          disabled ? styles.disabled : null,
        ]}
      >
        <Text style={styles.text}>{label}</Text>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    borderRadius: keyerButtonTheme.borderRadius,
    borderWidth: keyerButtonTheme.borderWidth,
    borderColor: colors.border,
    backgroundColor: surfaces.sunken,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing(keyerButtonTheme.paddingVerticalStep),
  },
  pressed: {
    backgroundColor: surfaces.pressed,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: colors.text,
    fontWeight: '800',
    fontSize: keyerButtonTheme.fontSize,
    letterSpacing: keyerButtonTheme.letterSpacing,
  },
});

export default KeyerButton;
