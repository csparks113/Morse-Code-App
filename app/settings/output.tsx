import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Animated, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import FlashOverlay from '@/components/session/FlashOverlay';
import KeyerButton from '@/components/session/KeyerButton';
import OutputTogglesRow from '@/components/session/OutputTogglesRow';
import { useOutputsService, type KeyerOutputsHandle } from '@/services/outputs/OutputsService';
import { useSettingsStore } from '@/store/useSettingsStore';
import { theme } from '@/theme/theme';
import { sessionLayoutTheme } from '@/theme/lessonTheme';
import { SETTINGS_LIMITS } from '@/constants/appConfig';

const CARD_BACKGROUND = theme.colors.surface ?? theme.colors.background;

function SettingSliderCard({
  title,
  description,
  value,
  min,
  max,
  step,
  formatValue,
  accessibilityLabel,
  onChange,
  onCommit,
}: {
  title: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formatValue: (value: number) => string;
  accessibilityLabel: string;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
}) {
  const clampToStep = React.useCallback(
    (next: number) => {
      const clamped = Math.min(max, Math.max(min, next));
      if (!Number.isFinite(step) || step <= 0) {
        return clamped;
      }
      const snapped = Math.round(clamped / step) * step;
      return Math.min(max, Math.max(min, snapped));
    },
    [min, max, step],
  );

  const [draftValue, setDraftValue] = React.useState(() => clampToStep(value));

  React.useEffect(() => {
    setDraftValue(clampToStep(value));
  }, [clampToStep, value]);

  const handleChange = React.useCallback(
    (next: number) => {
      const snapped = clampToStep(next);
      setDraftValue(snapped);
      onChange(snapped);
    },
    [clampToStep, onChange],
  );

  const handleComplete = React.useCallback(
    (next: number) => {
      const snapped = clampToStep(next);
      setDraftValue(snapped);
      onChange(snapped);
      if (onCommit && onCommit !== onChange) {
        onCommit(snapped);
      }
    },
    [clampToStep, onChange, onCommit],
  );

  const valueLabel = formatValue(draftValue);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardValue}>{valueLabel}</Text>
      </View>
      <Text style={styles.cardDescription}>{description}</Text>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={draftValue}
        onValueChange={handleChange}
        onSlidingComplete={handleComplete}
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min, max, now: Math.round(draftValue) }}
        minimumTrackTintColor={theme.colors.accent}
        maximumTrackTintColor={theme.colors.border}
        thumbTintColor={theme.colors.accent}
      />
    </View>
  );
}

const {
  audioVolumePercent: AUDIO_VOLUME_LIMITS,
  toneHz: TONE_LIMITS,
  flashBrightnessPercent: FLASH_LIMITS,
} = SETTINGS_LIMITS;

const PREVIEW_KEYER_MIN_HEIGHT = sessionLayoutTheme.inputZone.minHeight / 2;

export default function OutputSettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation(['settings', 'common']);
  const outputs = useOutputsService();

  const audioEnabled = useSettingsStore((state) => state.audioEnabled);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const lightEnabled = useSettingsStore((state) => state.lightEnabled);
  const torchEnabled = useSettingsStore((state) => state.torchEnabled);
  const audioVolumePercent = useSettingsStore((state) => state.audioVolumePercent);
  const flashBrightnessPercent = useSettingsStore((state) => state.flashBrightnessPercent);
  const screenBrightnessBoost = useSettingsStore((state) => state.screenBrightnessBoost);
  const toneHz = useSettingsStore((state) => state.toneHz);

  const setAudioEnabled = useSettingsStore((state) => state.setAudioEnabled);
  const setHapticsEnabled = useSettingsStore((state) => state.setHapticsEnabled);
  const setLightEnabled = useSettingsStore((state) => state.setLightEnabled);
  const setTorchEnabled = useSettingsStore((state) => state.setTorchEnabled);
  const setAudioVolumePercent = useSettingsStore((state) => state.setAudioVolumePercent);
  const setFlashBrightnessPercent = useSettingsStore((state) => state.setFlashBrightnessPercent);
  const setScreenBrightnessBoost = useSettingsStore((state) => state.setScreenBrightnessBoost);
  const setToneHz = useSettingsStore((state) => state.setToneHz);

  const previewOptions = React.useMemo(
    () => ({
      audioEnabled,
      hapticsEnabled,
      lightEnabled,
      torchEnabled,
      toneHz,
      audioVolumePercent,
      flashBrightnessPercent,
      screenBrightnessBoost,
    }),
    [
      audioEnabled,
      hapticsEnabled,
      lightEnabled,
      torchEnabled,
      toneHz,
      audioVolumePercent,
      flashBrightnessPercent,
      screenBrightnessBoost,
    ],
  );

  const previewOptionsRef = React.useRef(previewOptions);
  const keyerHandleRef = React.useRef<KeyerOutputsHandle | null>(null);
  const [flashOpacity, setFlashOpacity] = React.useState<Animated.Value | null>(null);

  const flashMaxOpacity = React.useMemo(() => {
    const scalar = Math.max(0, Math.min(1, flashBrightnessPercent / 100));
    return 0.28 * scalar;
  }, [flashBrightnessPercent]);

  React.useEffect(() => {
    const handle = outputs.createKeyerOutputs(previewOptionsRef.current, { source: 'settings.outputPreview' });
    keyerHandleRef.current = handle;
    setFlashOpacity(handle.flashOpacity);
    handle.prepare().catch(() => {});
    return () => {
      try {
        keyerHandleRef.current?.cutActiveOutputs('settings.cleanup');
      } catch {
        // ignore
      }
      handle.teardown().catch(() => {});
      keyerHandleRef.current = null;
      setFlashOpacity(null);
    };
  }, [outputs]);

  React.useEffect(() => {
    previewOptionsRef.current = previewOptions;
    keyerHandleRef.current?.updateOptions(previewOptions);
  }, [previewOptions]);

  const applyPreviewOptions = React.useCallback((partial: Partial<typeof previewOptions>) => {
    const next = { ...previewOptionsRef.current, ...partial };
    previewOptionsRef.current = next;
    keyerHandleRef.current?.updateOptions(next);
  }, []);

  const handleAudioVolumeChange = React.useCallback(
    (percent: number) => {
      setAudioVolumePercent(percent);
      applyPreviewOptions({ audioVolumePercent: percent });
    },
    [setAudioVolumePercent, applyPreviewOptions],
  );

  const handleToneHzChange = React.useCallback(
    (hz: number) => {
      setToneHz(hz);
      applyPreviewOptions({ toneHz: hz });
    },
    [setToneHz, applyPreviewOptions],
  );

  const handleFlashBrightnessChange = React.useCallback(
    (percent: number) => {
      setFlashBrightnessPercent(percent);
      applyPreviewOptions({ flashBrightnessPercent: percent });
    },
    [setFlashBrightnessPercent, applyPreviewOptions],
  );

  const handleScreenBrightnessBoostChange = React.useCallback(
    (enabled: boolean) => {
      setScreenBrightnessBoost(enabled);
      applyPreviewOptions({ screenBrightnessBoost: enabled });
    },
    [setScreenBrightnessBoost, applyPreviewOptions],
  );

  const handleAudioEnabledChange = React.useCallback(
    (enabled: boolean) => {
      setAudioEnabled(enabled);
      applyPreviewOptions({ audioEnabled: enabled });
    },
    [setAudioEnabled, applyPreviewOptions],
  );

  const handleHapticsEnabledChange = React.useCallback(
    (enabled: boolean) => {
      setHapticsEnabled(enabled);
      applyPreviewOptions({ hapticsEnabled: enabled });
    },
    [setHapticsEnabled, applyPreviewOptions],
  );

  const handleLightEnabledChange = React.useCallback(
    (enabled: boolean) => {
      setLightEnabled(enabled);
      applyPreviewOptions({ lightEnabled: enabled });
    },
    [setLightEnabled, applyPreviewOptions],
  );

  const handleTorchEnabledChange = React.useCallback(
    (enabled: boolean) => {
      setTorchEnabled(enabled);
      applyPreviewOptions({ torchEnabled: enabled });
    },
    [setTorchEnabled, applyPreviewOptions],
  );

  const handlePreviewPressIn = React.useCallback(() => {
    keyerHandleRef.current?.pressStart();
  }, []);

  const handlePreviewPressOut = React.useCallback(() => {
    keyerHandleRef.current?.cutActiveOutputs('settings.preview.release');
  }, []);

  const formatPercent = React.useCallback(
    (value: number) => t('settings:percentValue', { value: Math.round(value) }),
    [t],
  );

  const formatHz = React.useCallback(
    (value: number) => t('settings:hzValue', { value: Math.round(value) }),
    [t],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        {flashOpacity ? (
          <FlashOverlay opacity={flashOpacity} color={theme.colors.textPrimary} maxOpacity={flashMaxOpacity} />
        ) : null}

        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('common:back', { defaultValue: 'Back' })}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={22} color={theme.colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('settings:outputSettings')}</Text>
          <View style={styles.headerAccessory} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <SettingSliderCard
            title={t('settings:audioVolume')}
            description={t('settings:audioVolumeDescription')}
            value={audioVolumePercent}
            min={AUDIO_VOLUME_LIMITS.min}
            max={AUDIO_VOLUME_LIMITS.max}
            step={AUDIO_VOLUME_LIMITS.step}
            formatValue={formatPercent}
            accessibilityLabel={t('settings:adjustAudioVolume', { defaultValue: 'Adjust audio volume' })}
            onChange={handleAudioVolumeChange}
            onCommit={handleAudioVolumeChange}
          />

          <SettingSliderCard
            title={t('settings:tonePitch')}
            description={t('settings:tonePitchDescription')}
            value={toneHz}
            min={TONE_LIMITS.min}
            max={TONE_LIMITS.max}
            step={TONE_LIMITS.step}
            formatValue={formatHz}
            accessibilityLabel={t('settings:adjustTonePitch', { defaultValue: 'Adjust tone pitch' })}
            onChange={handleToneHzChange}
            onCommit={handleToneHzChange}
          />

          <SettingSliderCard
            title={t('settings:screenFlashBrightness')}
            description={t('settings:screenFlashBrightnessDescription')}
            value={flashBrightnessPercent}
            min={FLASH_LIMITS.min}
            max={FLASH_LIMITS.max}
            step={FLASH_LIMITS.step}
            formatValue={formatPercent}
            accessibilityLabel={t('settings:adjustScreenFlash', { defaultValue: 'Adjust screen flash brightness' })}
            onChange={handleFlashBrightnessChange}
            onCommit={handleFlashBrightnessChange}
          />

          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={styles.cardTitle}>
                  {t('settings:screenBrightnessBoost', { defaultValue: 'Boost screen brightness' })}
                </Text>
                <Text style={styles.toggleDescription}>
                  {t('settings:screenBrightnessBoostDescription', {
                    defaultValue: 'Temporarily raise screen brightness during native flashes so they stay visible even on a dim device.',
                  })}
                </Text>
              </View>
              <Switch
                value={screenBrightnessBoost}
                onValueChange={handleScreenBrightnessBoostChange}
                trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
                thumbColor={screenBrightnessBoost ? theme.colors.accent : theme.colors.surface}
              />
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t('settings:outputsTitle', { defaultValue: 'Outputs' })}</Text>
            <OutputTogglesRow
              audioEnabled={audioEnabled}
              hapticsEnabled={hapticsEnabled}
              lightEnabled={lightEnabled}
              torchEnabled={torchEnabled}
              setAudioEnabled={handleAudioEnabledChange}
              setHapticsEnabled={handleHapticsEnabledChange}
              setLightEnabled={handleLightEnabledChange}
              setTorchEnabled={handleTorchEnabledChange}
            />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t('settings:previewKeyerHeading', { defaultValue: 'Preview keyer' })}</Text>
            <Text style={styles.sectionSubtitle}>
              {t('settings:previewKeyerDescription', {
                defaultValue: 'Press and hold to test your audio, haptics, and flash outputs using the current settings.',
              })}
            </Text>
            <KeyerButton
              label={t('settings:previewKeyerButton', { defaultValue: 'Test keyer' })}
              minHeight={PREVIEW_KEYER_MIN_HEIGHT}
              onPressIn={handlePreviewPressIn}
              onPressOut={handlePreviewPressOut}
              disabled={!audioEnabled && !hapticsEnabled && !lightEnabled}
            />
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    padding: 4,
  },
  headerAccessory: {
    width: 22,
    height: 22,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.6,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
    gap: 16,
  },
  card: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#00000033',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  cardValue: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
  cardDescription: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleText: {
    flex: 1,
  },
  toggleDescription: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  slider: {
    width: '100%',
  },
  sectionCard: {
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#00000033',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
});
