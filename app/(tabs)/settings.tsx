import React from 'react';
import { View, Text, StyleSheet, Switch, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme/theme';
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
    wpm,
    toneHz,
    setReceiveOnly,
    setAudioEnabled,
    setLightEnabled,
    setHapticsEnabled,
    setWpm,
    setToneHz,
  } = useSettingsStore();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.headerDivider} />

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

        {/* WPM control */}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Speed (WPM)</Text>
            <Text style={styles.rowSub}>
              Controls Morse timing (dot = 1200 / WPM ms)
            </Text>
          </View>
          <View style={styles.stepper}>
            <Pressable
              accessibilityLabel="Decrease WPM"
              onPress={() => setWpm(Math.max(5, wpm - 1))}
              style={({ pressed }) => [styles.step, pressed && styles.pressed]}
            >
              <Text style={styles.stepText}>-</Text>
            </Pressable>
            <Text style={styles.stepValue}>{wpm}</Text>
            <Pressable
              accessibilityLabel="Increase WPM"
              onPress={() => setWpm(Math.min(60, wpm + 1))}
              style={({ pressed }) => [styles.step, pressed && styles.pressed]}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        </View>

        {/* Tone pitch control */}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Tone Pitch</Text>
            <Text style={styles.rowSub}>Adjust audio tone frequency (Hz)</Text>
          </View>
          <View style={styles.stepper}>
            <Pressable
              accessibilityLabel="Decrease tone pitch"
              onPress={() => setToneHz(Math.max(200, toneHz - 10))}
              style={({ pressed }) => [styles.step, pressed && styles.pressed]}
            >
              <Text style={styles.stepText}>-</Text>
            </Pressable>
            <Text style={styles.stepValue}>{toneHz} Hz</Text>
            <Pressable
              accessibilityLabel="Increase tone pitch"
              onPress={() => setToneHz(Math.min(1200, toneHz + 10))}
              style={({ pressed }) => [styles.step, pressed && styles.pressed]}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        </View>
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
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(3),
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
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  step: {
    backgroundColor: theme.colors.textSecondary,
    borderRadius: theme.radius.pill,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    color: theme.colors.background,
    fontWeight: '800',
    fontSize: 18,
  },
  stepValue: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    minWidth: 36,
    textAlign: 'center',
  },
  pressed: { opacity: 0.92 },
});
