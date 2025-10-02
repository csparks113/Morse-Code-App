// components/session/OutputTogglesRow.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing, sessionLayoutTheme } from '@/theme/lessonTheme';
import OutputToggle from '@/components/session/OutputToggle';

type Props = {
  hapticsEnabled: boolean;
  lightEnabled: boolean;
  audioEnabled: boolean;
  torchEnabled: boolean;
  setHapticsEnabled: (v: boolean) => void;
  setLightEnabled: (v: boolean) => void;
  setAudioEnabled: (v: boolean) => void;
  setTorchEnabled: (v: boolean) => void;
};

export default function OutputTogglesRow({
  hapticsEnabled,
  lightEnabled,
  audioEnabled,
  torchEnabled,
  setHapticsEnabled,
  setLightEnabled,
  setAudioEnabled,
  setTorchEnabled,
}: Props) {
  return (
    <View style={styles.outputContainer}>
      <View style={styles.toggleRow}>
        <OutputToggle
          icon="vibrate"
          accessibilityLabel="Toggle haptics"
          active={hapticsEnabled}
          onPress={() => setHapticsEnabled(!hapticsEnabled)}
        />
        <OutputToggle
          icon="monitor"
          accessibilityLabel="Toggle screen flash"
          active={lightEnabled}
          onPress={() => setLightEnabled(!lightEnabled)}
        />
        <OutputToggle
          icon="volume-high"
          accessibilityLabel="Toggle audio"
          active={audioEnabled}
          onPress={() => setAudioEnabled(!audioEnabled)}
        />
        <OutputToggle
          icon="flashlight"
          accessibilityLabel="Toggle flashlight"
          active={torchEnabled}
          onPress={() => setTorchEnabled(!torchEnabled)}
        />
      </View>
    </View>
  );
}

const togglesLayout = sessionLayoutTheme.toggles;

const styles = StyleSheet.create({
  outputContainer: {
    alignSelf: 'stretch',
    paddingHorizontal: spacing(togglesLayout.paddingHorizontalStep),
    paddingVertical: spacing(togglesLayout.paddingVerticalStep),
    justifyContent: 'center',
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    columnGap: spacing(togglesLayout.columnGapStep),
    flexWrap: 'nowrap',
    width: '100%',
  },
});
