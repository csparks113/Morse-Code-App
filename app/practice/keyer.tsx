
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useRouter } from 'expo-router';

import SessionHeader from '@/components/session/SessionHeader';
import OutputTogglesRow from '@/components/session/OutputTogglesRow';
import TorchDiagnosticsNotice from '@/components/session/TorchDiagnosticsNotice';
import KeyerButton from '@/components/session/KeyerButton';
import FlashOverlay from '@/components/session/FlashOverlay';
import { useKeyerOutputs } from '@/hooks/useKeyerOutputs';
import { createPressTracker } from '@/services/latency/pressTracker';
import { useSettingsStore } from '@/store/useSettingsStore';
import { sessionStyleSheet, sessionContainerPadding } from '@/theme/sessionStyles';
import { colors, surfaces, spacing, sessionLayoutTheme } from '@/theme/lessonTheme';
import { typography, fontWeight } from '@/theme/tokens';

const inputZoneMinHeight = sessionLayoutTheme.inputZone.minHeight;

export default function PracticeKeyerScreen() {
  const { t } = useTranslation('practice');
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const audioEnabled = useSettingsStore((state) => state.audioEnabled);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const lightEnabled = useSettingsStore((state) => state.lightEnabled);
  const torchEnabled = useSettingsStore((state) => state.torchEnabled);
  const setAudioEnabled = useSettingsStore((state) => state.setAudioEnabled);
  const setHapticsEnabled = useSettingsStore((state) => state.setHapticsEnabled);
  const setLightEnabled = useSettingsStore((state) => state.setLightEnabled);
  const setTorchEnabled = useSettingsStore((state) => state.setTorchEnabled);
  const toneHzSetting = useSettingsStore((state) => state.toneHz as unknown as string | number);
  const audioVolumePercent = useSettingsStore((state) => state.audioVolumePercent ?? 100);
  const flashBrightnessPercent = useSettingsStore((state) => state.flashBrightnessPercent ?? 80);
  const screenBrightnessBoost = useSettingsStore((state) => state.screenBrightnessBoost ?? false);

  const toneHz = React.useMemo(() => {
    const parsed = Number(toneHzSetting);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 600;
  }, [toneHzSetting]);

  const flashMaxOpacity = React.useMemo(() => {
    return 0.28 * Math.max(0, Math.min(1, flashBrightnessPercent / 100));
  }, [flashBrightnessPercent]);

  const pressTracker = React.useMemo(() => createPressTracker('practice.keyer'), []);

  const { onDown, onUp, flashOpacity, prepare, teardown } = useKeyerOutputs(
    {
      audioEnabled,
      hapticsEnabled,
      lightEnabled,
      torchEnabled,
      toneHz,
      audioVolumePercent,
      flashBrightnessPercent,
      screenBrightnessBoost,
    },
    { source: 'practice.keyer', pressTracker },
  );

  useFocusEffect(
    React.useCallback(() => {
      prepare().catch(() => {});
      return () => {
        teardown().catch(() => {});
      };
    }, [prepare, teardown]),
  );

  const handleClose = React.useCallback(() => {
    router.back();
  }, [router]);

  return (
    <SafeAreaView style={sessionStyleSheet.safe} edges={[]}>
      <View
        style={[
          sessionStyleSheet.container,
          sessionContainerPadding(insets, {
            topStep: sessionLayoutTheme.footer.topPaddingStep,
            footerVariant: 'practice',
          }),
        ]}
      >
        <FlashOverlay opacity={flashOpacity} color={colors.text} maxOpacity={flashMaxOpacity} />
        <View style={sessionStyleSheet.topGroup}>
          <SessionHeader
            labelTop={t('keyerLabHeaderTop')}
            labelBottom={t('keyerLabHeaderBottom')}
            onClose={handleClose}
            exitToHome={false}
            showCloseButton
          />
          <Text style={styles.instructions}>{t('keyerLabInstructions')}</Text>
        </View>

        <View style={styles.centerSpacer} />

        <View style={sessionStyleSheet.bottomGroup}>
          <View style={[sessionStyleSheet.togglesWrap, styles.toggleContainer]}>
            <OutputTogglesRow
              hapticsEnabled={hapticsEnabled}
              lightEnabled={lightEnabled}
              audioEnabled={audioEnabled}
              torchEnabled={torchEnabled}
              setHapticsEnabled={setHapticsEnabled}
              setLightEnabled={setLightEnabled}
              setAudioEnabled={setAudioEnabled}
              setTorchEnabled={setTorchEnabled}
            />
            <TorchDiagnosticsNotice />
          </View>

          <View style={[sessionStyleSheet.inputZone, styles.keyerZone]}>
            <KeyerButton
              onPressIn={onDown}
              onPressOut={onUp}
              disabled={false}
              minHeight={inputZoneMinHeight}
              label={t('keyerLabButtonLabel')}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  instructions: {
    color: colors.textDim,
    textAlign: 'center',
    fontSize: typography.body,
    fontWeight: fontWeight.medium,
    marginTop: spacing(1.5),
  },
  centerSpacer: {
    flex: 1,
  },
  toggleContainer: {
    backgroundColor: surfaces.card,
    borderRadius: 20,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.5),
    marginBottom: spacing(2),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  keyerZone: {
    borderRadius: 24,
    backgroundColor: surfaces.sunken,
    padding: spacing(2),
  },
});







