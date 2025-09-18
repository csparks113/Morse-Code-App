/**
 * SETTINGS SCREEN (Morse Code Master)
 * -----------------------------------
 * OVERVIEW
 * This screen lets the user configure how lessons feel and behave:
 *  - Which outputs are used (audio, screen flash, flashlight, haptics)
 *  - Whether to focus on *receiving only* (hide Send interactions)
 *  - Timing parameters for Morse (WPM, signal/gap tolerances)
 *  - Audio tone pitch (Hz)
 *
 * HOW IT WORKS
 * - All values come from a global settings store (Zustand): `useSettingsStore`.
 * - Simple boolean options use a reusable <Row /> with a native <Switch />.
 * - Numeric options (WPM / tolerances / tone Hz) use +/- steppers with clamps.
 * - Styles and colors are pulled from a shared `theme`.
 *
 * WHY THIS MATTERS
 * - WPM determines the base unit time used for Morse (dot length = 1200 / WPM ms).
 * - Tolerances are the “forgiveness” windows when *sending*: how close a press
 *   needs to be to count as dot/dash (signal) or the gap category (gap).
 * - Output toggles let learners tailor sensory feedback to their environment.
 */

import React from 'react';
import { View, Text, StyleSheet, Switch, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme/theme';
import { useSettingsStore } from '../../store/useSettingsStore';

/**
 * Small, reusable row component that renders:
 *   - a title/subtitle on the left
 *   - a native Switch on the right
 * We use this for boolean settings (Audio, Haptics, etc.).
 */
type RowProps = {
  title: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
};

function Row({ title, sub, value, onChange }: RowProps) {
  return (
    <View style={styles.row}>
      {/* Left column: label(s) */}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {!!sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>

      {/* Right column: on/off switch */}
      <Switch
        value={value}
        onValueChange={onChange}
        // Different track colors for on/off states
        trackColor={{
          true: theme.colors.textSecondary,
          false: theme.colors.border,
        }}
        // Thumb color pops when enabled
        thumbColor={value ? theme.colors.accent : '#888'}
      />
    </View>
  );
}

/**
 * MAIN SETTINGS SCREEN
 * Pulls current values + setter functions from the settings store,
 * then lays out all toggles and numeric steppers.
 */
export default function SettingsScreen() {
  // Read state and setters from the global settings store (Zustand).
  const {
    receiveOnly,
    audioEnabled,
    lightEnabled,
    torchEnabled,
    hapticsEnabled,
    wpm,
    toneHz,
    signalTolerancePercent,
    gapTolerancePercent,
    setReceiveOnly,
    setAudioEnabled,
    setLightEnabled,
    setTorchEnabled,
    setHapticsEnabled,
    setWpm,
    setToneHz,
    setSignalTolerancePercent,
    setGapTolerancePercent,
  } = useSettingsStore();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.headerDivider} />

        {/* Receive-only mode:
            - For learners who only want to practice listening/recognition.
            - Hides Send controls in session screens. */}
        <Row
          title="Receive-only mode"
          sub="Hide Send buttons and focus on recognition"
          value={receiveOnly}
          onChange={setReceiveOnly}
        />

        {/* Output toggles: control which cues are used during lessons */}
        <Row
          title="Audio"
          sub="Play dot/dash tones in lessons"
          value={audioEnabled}
          onChange={setAudioEnabled}
        />

        <Row
          title="Screen flash"
          sub="Blink a visual overlay with each dot/dash"
          value={lightEnabled}
          onChange={setLightEnabled}
        />

        <Row
          title="Flashlight"
          sub="Use the device torch for output cues"
          value={torchEnabled}
          onChange={setTorchEnabled}
        />

        <Row
          title="Haptics"
          sub="Vibrate on key presses and feedback"
          value={hapticsEnabled}
          onChange={setHapticsEnabled}
        />

        {/* WPM control:
            - Morse timing is derived from WPM: dot = 1200 / WPM milliseconds.
            - We clamp between 5 and 60 to avoid unusable extremes. */}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Send Speed (WPM)</Text>
            <Text style={styles.rowSub}>
              Controls Morse timing (dot = 1200 / WPM ms)
            </Text>
          </View>

          <View style={styles.stepper}>
            <Pressable
              accessibilityLabel="Decrease send speed"
              onPress={() => setWpm(Math.max(5, wpm - 1))}
              style={({ pressed }) => [styles.step, pressed && styles.pressed]}
            >
              <Text style={styles.stepText}>-</Text>
            </Pressable>

            <Text style={styles.stepValue}>{wpm}</Text>

            <Pressable
              accessibilityLabel="Increase send speed"
              onPress={() => setWpm(Math.min(60, wpm + 1))}
              style={({ pressed }) => [styles.step, pressed && styles.pressed]}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        </View>

        {/* Signal tolerance:
            - Forgiveness for press lengths when *sending*.
            - Example: ±30% means a "dot" press can be 30% shorter/longer than ideal.
            - Change step: 5%. */}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Signal tolerance</Text>
            <Text style={styles.rowSub}>
              Acceptable dot/dash window (±{signalTolerancePercent}%)
            </Text>
          </View>

          <View style={styles.stepper}>
            <Pressable
              accessibilityLabel="Decrease signal tolerance"
              onPress={() => setSignalTolerancePercent(signalTolerancePercent - 5)}
              style={({ pressed }) => [styles.step, pressed && styles.pressed]}
            >
              <Text style={styles.stepText}>-</Text>
            </Pressable>

            <Text style={styles.stepValue}>{signalTolerancePercent}%</Text>

            <Pressable
              accessibilityLabel="Increase signal tolerance"
              onPress={() => setSignalTolerancePercent(signalTolerancePercent + 5)}
              style={({ pressed }) => [styles.step, pressed && styles.pressed]}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        </View>

        {/* Gap tolerance:
            - Forgiveness for pauses between presses when *sending*.
            - Helps the app decide if a pause was “intra-character” vs “inter-character”, etc.
            - Change step: 5%. */}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Gap tolerance</Text>
            <Text style={styles.rowSub}>
              Acceptable pause window (±{gapTolerancePercent}%)
            </Text>
          </View>

          <View style={styles.stepper}>
            <Pressable
              accessibilityLabel="Decrease gap tolerance"
              onPress={() => setGapTolerancePercent(gapTolerancePercent - 5)}
              style={({ pressed }) => [styles.step, pressed && styles.pressed]}
            >
              <Text style={styles.stepText}>-</Text>
            </Pressable>

            <Text style={styles.stepValue}>{gapTolerancePercent}%</Text>

            <Pressable
              accessibilityLabel="Increase gap tolerance"
              onPress={() => setGapTolerancePercent(gapTolerancePercent + 5)}
              style={({ pressed }) => [styles.step, pressed && styles.pressed]}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        </View>

        {/* Tone pitch control:
            - Adjust the sine tone frequency used for audio playback.
            - Typical comfortable range is ~400–800 Hz; we clamp 200–1200 Hz. */}
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

/**
 * Styles
 * Clean, card-like rows with consistent spacing and a soft shadow.
 */
const styles = StyleSheet.create({
  // Full-screen background matches app theme
  safe: { flex: 1, backgroundColor: theme.colors.background },

  // Page container: padding + vertical spacing between rows
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing(4),
    gap: theme.spacing(4),
  },

  // Big page title
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: '800',
  },

  // Thin divider under the title
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },

  // Generic row "card"
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing(4),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    ...theme.shadow.card, // soft, subtle shadow from theme
    gap: theme.spacing(2),
  },

  // Row main title
  rowTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Optional sublabel under the title
  rowSub: {
    color: theme.colors.muted,
    marginTop: theme.spacing(1),
    fontSize: theme.typography.small,
  },

  // Stepper container (for numeric controls)
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
  },

  // The +/- action chip
  step: {
    backgroundColor: theme.colors.textSecondary,
    borderRadius: theme.radius.pill,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // +/- glyph style
  stepText: {
    color: theme.colors.background,
    fontWeight: '800',
    fontSize: 18,
  },

  // Current numeric value
  stepValue: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    minWidth: 48,
    textAlign: 'center',
  },

  // Slight visual feedback while pressing
  pressed: { opacity: 0.92 },
});
