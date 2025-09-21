// components/session/OutputTogglesRow.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing } from '@/theme/lessonTheme';
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

const styles = StyleSheet.create({
  outputContainer: {
    alignSelf: 'stretch',
    paddingHorizontal: spacing(2.5),
    paddingTop: spacing(1),
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing(1.5),
    rowGap: spacing(1.5),
    width: '100%',
  },
});

