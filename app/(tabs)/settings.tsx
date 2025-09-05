import React from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import { useSettingsStore } from '../../store/useSettingsStore';

type RowProps = {
  title: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
};

function Row({ title, sub, value, onChange }: RowProps) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {!!sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{
          true: theme.colors.textSecondary,
          false: theme.colors.border,
        }}
        thumbColor={value ? theme.colors.accent : '#888'}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const {
    receiveOnly,
    audioEnabled,
    lightEnabled,
    hapticsEnabled,
    setReceiveOnly,
    setAudioEnabled,
    setLightEnabled,
    setHapticsEnabled,
  } = useSettingsStore();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Settings</Text>

        <Row
          title="Receive-only mode"
          sub="Hide Send buttons and focus on recognition"
          value={receiveOnly}
          onChange={setReceiveOnly}
        />

        <Row
          title="Audio"
          sub="Play dot/dash tones in lessons"
          value={audioEnabled}
          onChange={setAudioEnabled}
        />

        <Row
          title="Light (flash)"
          sub="Blink a visual overlay with each dot/dash"
          value={lightEnabled}
          onChange={setLightEnabled}
        />

        <Row
          title="Haptics"
          sub="Vibrate on key presses and feedback"
          value={hapticsEnabled}
          onChange={setHapticsEnabled}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing(4),
    gap: theme.spacing(4),
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing(4),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
    gap: theme.spacing(2),
  },
  rowTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  rowSub: {
    color: theme.colors.muted,
    marginTop: theme.spacing(1),
    fontSize: theme.typography.small,
  },
});
