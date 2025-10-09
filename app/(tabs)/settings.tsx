import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import {
  getAvailableLanguages,
  setLanguage as setAppLanguage,
  getStoredLanguage,
  type LanguageOption,
  type SupportedLanguage,
} from '@/i18n';
import { useSettingsStore } from '../../store/useSettingsStore';
import { theme } from '../../theme/theme';
import { withAlpha } from '@/theme/tokens';
import { Ionicons } from '@expo/vector-icons';
import { SETTINGS_LIMITS } from '@/constants/appConfig';
import { useProgressStore } from '../../store/useProgressStore';
import { useDeveloperStore } from '@/store/useDeveloperStore';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

type StepperRowProps = {
  title: string;
  description: string;
  valueLabel: string;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseLabel: string;
  increaseLabel: string;
};

function StepperRow({
  title,
  description,
  valueLabel,
  onDecrease,
  onIncrease,
  decreaseLabel,
  increaseLabel,
}: StepperRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{description}</Text>
      </View>
      <View style={styles.stepper}>
        <Pressable
          accessibilityLabel={decreaseLabel}
          onPress={onDecrease}
          style={({ pressed }) => [styles.step, pressed && styles.pressed]}
        >
          <Text style={styles.stepText}>-</Text>
        </Pressable>
        <Text style={styles.stepValue}>{valueLabel}</Text>
        <Pressable
          accessibilityLabel={increaseLabel}
          onPress={onIncrease}
          style={({ pressed }) => [styles.step, pressed && styles.pressed]}
        >
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const {
  wpm: WPM_LIMITS,
  signalTolerancePercent: SIGNAL_LIMITS,
  gapTolerancePercent: GAP_LIMITS,
} = SETTINGS_LIMITS;

export default function SettingsScreen() {
  const { t } = useTranslation(['settings', 'common']);

  const {
    wpm,
    signalTolerancePercent,
    gapTolerancePercent,
    setWpm,
    setSignalTolerancePercent,
    setGapTolerancePercent,
  } = useSettingsStore();

  const { resetAll } = useProgressStore();
  const router = useRouter();

  const developerMode = useDeveloperStore((state) => state.developerMode);
  const setDeveloperMode = useDeveloperStore((state) => state.setDeveloperMode);
  const outputsTracingEnabled = useDeveloperStore((state) => state.outputsTracingEnabled);
  const setOutputsTracingEnabled = useDeveloperStore((state) => state.setOutputsTracingEnabled);
  const clearTraces = useDeveloperStore((state) => state.clearTraces);
  const traceCount = useDeveloperStore((state) => state.traces.length);

  const unlockRef = React.useRef<{ count: number; timeout: ReturnType<typeof setTimeout> | null }>({
    count: 0,
    timeout: null,
  });

  const versionLabel = React.useMemo(() => {
    const config = Constants.expoConfig;
    const version = config?.version ?? 'dev';
    const buildNumbers = [config?.ios?.buildNumber, config?.android?.versionCode]
      .filter((value) => value != null && value !== '');
    if (buildNumbers.length > 0) {
      return `${version} (${buildNumbers.join('/')})`;
    }
    return version;
  }, []);

  const handleUnlockPress = React.useCallback(() => {
    if (developerMode) {
      return;
    }
    const ref = unlockRef.current;
    if (ref.timeout) {
      clearTimeout(ref.timeout);
    }
    ref.count += 1;
    if (ref.count >= 5) {
      setDeveloperMode(true);
      ref.count = 0;
      Alert.alert('Developer Mode', 'Developer tools unlocked. A new section is available below.');
    } else {
      ref.timeout = setTimeout(() => {
        ref.count = 0;
        ref.timeout = null;
      }, 1200);
    }
  }, [developerMode, setDeveloperMode]);

  React.useEffect(() => {
    return () => {
      const ref = unlockRef.current;
      if (ref.timeout) {
        clearTimeout(ref.timeout);
      }
    };
  }, []);

  const handleToggleDeveloperMode = React.useCallback(
    (value: boolean) => {
      setDeveloperMode(value);
      if (!value) {
        setOutputsTracingEnabled(false);
        clearTraces();
      }
    },
    [clearTraces, setDeveloperMode, setOutputsTracingEnabled],
  );

  const handleTracingToggle = React.useCallback(
    (value: boolean) => {
      setOutputsTracingEnabled(value);
      if (value) {
        setDeveloperMode(true);
      }
    },
    [setDeveloperMode, setOutputsTracingEnabled],
  );

  const handleClearTraces = React.useCallback(() => {
    clearTraces();
  }, [clearTraces]);

  const handleOpenConsole = React.useCallback(() => {
    router.push('/dev');
  }, [router]);

  const developerSectionVisible = developerMode;

  const languageOptions = React.useMemo<LanguageOption[]>(() => getAvailableLanguages(), []);
  const [languageModalVisible, setLanguageModalVisible] = React.useState(false);
  const [resetModalVisible, setResetModalVisible] = React.useState(false);
  const [selectedLanguage, setSelectedLanguage] = React.useState<SupportedLanguage>('system');

  React.useEffect(() => {
    getStoredLanguage()
      .then(setSelectedLanguage)
      .catch(() => setSelectedLanguage('system'));
  }, []);

  const resolveLanguageLabel = React.useCallback(
    (value: SupportedLanguage) => {
      const option = languageOptions.find((item) => item.value === value);
      return option ? t(option.labelKey) : value;
    },
    [languageOptions, t],
  );

  const languageLabel = resolveLanguageLabel(selectedLanguage);

  const handleSelectLanguage = React.useCallback(
    async (value: SupportedLanguage) => {
      setSelectedLanguage(value);
      await setAppLanguage(value);
      setLanguageModalVisible(false);
    },
    [],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title} numberOfLines={2}>
          {t('settings:title')}
        </Text>
        <View style={styles.headerDivider} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Pressable
            style={({ pressed }) => [styles.row, styles.languageRow, pressed && styles.pressed]}
            onPress={() => setLanguageModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t('settings:language')}
          >
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>{t('settings:language')}</Text>
              <Text style={styles.rowSub}>{t('settings:languageDescription')}</Text>
            </View>
            <Text style={styles.languageValue}>{languageLabel}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => router.push('/settings/output')}
            accessibilityRole="button"
            accessibilityLabel={t('settings:outputSettings')}
          >
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>{t('settings:outputSettings')}</Text>
              <Text style={styles.rowSub}>{t('settings:outputSettingsDescription')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </Pressable>

          <StepperRow
            title={t('settings:sendSpeed')}
            description={t('settings:sendSpeedDescription')}
            valueLabel={t('settings:wpmValue', { value: wpm })}
            onDecrease={() => setWpm(wpm - WPM_LIMITS.step)}
            onIncrease={() => setWpm(wpm + WPM_LIMITS.step)}
            decreaseLabel={t('settings:decreaseSendSpeed')}
            increaseLabel={t('settings:increaseSendSpeed')}
          />

          <StepperRow
            title={t('settings:signalTolerance')}
            description={t('settings:signalToleranceDescription')}
            valueLabel={t('settings:percentValue', { value: signalTolerancePercent })}
            onDecrease={() =>
              setSignalTolerancePercent(signalTolerancePercent - SIGNAL_LIMITS.step)
            }
            onIncrease={() =>
              setSignalTolerancePercent(signalTolerancePercent + SIGNAL_LIMITS.step)
            }
            decreaseLabel={t('settings:decreaseSignalTolerance')}
            increaseLabel={t('settings:increaseSignalTolerance')}
          />

          <StepperRow
            title={t('settings:gapTolerance')}
            description={t('settings:gapToleranceDescription')}
            valueLabel={t('settings:percentValue', { value: gapTolerancePercent })}
            onDecrease={() => setGapTolerancePercent(gapTolerancePercent - GAP_LIMITS.step)}
            onIncrease={() => setGapTolerancePercent(gapTolerancePercent + GAP_LIMITS.step)}
            decreaseLabel={t('settings:decreaseGapTolerance')}
            increaseLabel={t('settings:increaseGapTolerance')}
          />

      {/* Danger zone */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('common:settings')}</Text>
        <Pressable
          onPress={() => setResetModalVisible(true)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed, { borderColor: '#FF3B30' }]}
          accessibilityRole="button"
          accessibilityLabel="Reset learning progress"
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: '#FF3B30' }]}>Reset learning progress</Text>
            <Text style={[styles.rowSub, { color: '#FF3B30' }]}>Clears all lesson/review/challenge completion</Text>
          </View>
        </Pressable>
      </View>

      <Modal
        visible={resetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResetModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reset progress?</Text>
            <Text style={styles.modalText}>This will clear all learning progress. This cannot be undone.</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 16 }}>
              <Pressable onPress={() => setResetModalVisible(false)} style={({pressed})=>[styles.modalBtn, pressed && styles.pressed]}>
                <Text style={styles.modalBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={async () => { await resetAll(); setResetModalVisible(false);}}
                style={({pressed})=>[styles.modalBtn, { backgroundColor: '#FF3B30' }, pressed && styles.pressed]}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Reset</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

          <Pressable
            accessibilityRole="button"
            onPress={handleUnlockPress}
            style={({ pressed }) => [styles.buildRow, pressed && styles.pressed]}
          >
            <View style={styles.buildInfo}>
              <Text style={styles.buildLabel}>Build</Text>
              <Text style={styles.buildValue}>{versionLabel}</Text>
            </View>
            <Text style={styles.buildHint}>
              {developerMode ? 'Developer mode enabled' : 'Tap five times to unlock'}
            </Text>
          </Pressable>

          {developerSectionVisible ? (
            <View style={[styles.section, styles.developerSection]}>
              <View style={[styles.row, styles.developerRow]}>
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle}>Developer mode</Text>
                  <Text style={styles.rowSub}>Unlock hidden tools and debug surfaces.</Text>
                </View>
                <Switch
                  value={developerMode}
                  onValueChange={handleToggleDeveloperMode}
                  trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
                  thumbColor={developerMode ? theme.colors.accent : theme.colors.disabled}
                />
              </View>

              <View style={[styles.row, styles.developerRow]}>
                <View style={styles.rowContent}>
                  <Text style={styles.rowTitle}>Outputs tracing</Text>
                  <Text style={styles.rowSub}>
                    Logs keyer / replay events ({traceCount} cached).
                  </Text>
                </View>
                <Switch
                  value={outputsTracingEnabled}
                  onValueChange={handleTracingToggle}
                  trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
                  thumbColor={outputsTracingEnabled ? theme.colors.accent : theme.colors.disabled}
                />
              </View>

              <Pressable
                onPress={handleOpenConsole}
                accessibilityRole="button"
                style={({ pressed }) => [styles.devButton, pressed && styles.pressed]}
              >
                <Text style={styles.devButtonText}>Open developer console</Text>
              </Pressable>

              <Pressable
                onPress={handleClearTraces}
                accessibilityRole="button"
                style={({ pressed }) => [styles.devButtonGhost, pressed && styles.pressed]}
              >
                <Text style={styles.devButtonGhostText}>Clear trace buffer</Text>
              </Pressable>
            </View>
          ) : null}

        </ScrollView>
    
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={languageModalVisible}
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLanguageModalVisible(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('settings:language')}</Text>
            {languageOptions.map((option) => {
              const optionLabel = t(option.labelKey);
              const isSelected = option.value === selectedLanguage;
              return (
                <Pressable
                  key={option.value}
                  style={({ pressed }) => [styles.languageOption, pressed && styles.pressed]}
                  onPress={() => handleSelectLanguage(option.value)}
                  accessibilityRole="button"
                  accessibilityLabel={optionLabel}
                >
                  <Text
                    style={[
                      styles.languageOptionLabel,
                      isSelected && styles.languageOptionSelected,
                    ]}
                  >
                    {optionLabel}
                  </Text>
                  {isSelected && (
                    <Text style={styles.languageOptionCheck}>
                      {String.fromCharCode(0x2713)}
                    </Text>
                  )}
                </Pressable>
              );
            })}
            <Pressable
              style={({ pressed }) => [styles.closeModalButton, pressed && styles.pressed]}
              onPress={() => setLanguageModalVisible(false)}
            >
              <Text style={styles.closeModalText}>{t('common:close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    textAlign: 'auto',
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginTop: theme.spacing(2),
  },
  scrollContent: {
    gap: theme.spacing(3),
    paddingBottom: theme.spacing(6),
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
  rowContent: { flex: 1, gap: theme.spacing(1) },
  rowTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'auto',
  },
  rowSub: {
    color: theme.colors.muted,
    fontSize: theme.typography.small,
    textAlign: 'auto',
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
    textAlign: 'center',
  },
  stepValue: {
    color: theme.colors.textPrimary,
    fontWeight: '800',
    minWidth: 64,
    textAlign: 'center',
  },
  pressed: { opacity: 0.92 },
  languageRow: {
    justifyContent: 'space-between',
  },
  languageValue: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    textAlign: 'auto',
  },
  section: {
    gap: theme.spacing(2),
    paddingTop: theme.spacing(3),
  },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
    fontSize: theme.typography.tiny,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'auto',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: withAlpha(theme.colors.background, 0.6),
    justifyContent: 'center',
    padding: theme.spacing(4),
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing(4),
    gap: theme.spacing(2),
  },
  modalTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: theme.typography.subtitle,
    textAlign: 'auto',
  },
  modalText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.small,
    textAlign: 'auto',
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(2),
    paddingVertical: theme.spacing(1.5),
  },
  languageOptionLabel: {
    color: theme.colors.textPrimary,
    textAlign: 'auto',
  },
  languageOptionSelected: {
    fontWeight: '700',
    color: theme.colors.accent,
  },
  languageOptionCheck: {
    color: theme.colors.accent,
    fontWeight: '700',
  },
  closeModalButton: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(1.5),
  },
  closeModalText: {
    color: theme.colors.background,
    fontWeight: '700',
    textAlign: 'auto',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: withAlpha(theme.colors.background, 0.6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtn: {
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1.5),
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  modalBtnText: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
    textAlign: 'auto',
  },
  buildRow: {
    marginTop: theme.spacing(4),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(2.5),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    gap: theme.spacing(3),
  },
  buildInfo: {
    flex: 1,
    gap: theme.spacing(0.5),
  },
  buildLabel: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
    fontSize: theme.typography.tiny,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  buildValue: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
  },
  buildHint: {
    color: theme.colors.textSecondary,
    textAlign: 'right',
    flexShrink: 1,
  },
  developerSection: {
    gap: theme.spacing(2),
    paddingBottom: theme.spacing(4),
  },
  developerRow: {
    alignItems: 'center',
  },
  devButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing(2),
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.accent,
  },
  devButtonText: {
    color: theme.colors.background,
    fontWeight: '700',
  },
  devButtonGhost: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing(2),
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  devButtonGhostText: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },
});






