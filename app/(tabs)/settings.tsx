import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal } from 'react-native';
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
import { useProgressStore } from '../../store/useProgressStore';

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

const MIN_WPM = 5;
const MAX_WPM = 20;
const WPM_STEP = 1;
const MIN_PERCENT = 5;
const MAX_PERCENT = 95;
const PERCENT_STEP = 5;
const MIN_HZ = 200;
const MAX_HZ = 1200;
const HZ_STEP = 10;

export default function SettingsScreen() {
  const { t } = useTranslation(['settings', 'common']);

  const {
    wpm,
    toneHz,
    signalTolerancePercent,
    gapTolerancePercent,
    setWpm,
    setToneHz,
    setSignalTolerancePercent,
    setGapTolerancePercent,
  } = useSettingsStore();

  const { resetAll } = useProgressStore();

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


          <StepperRow
            title={t('settings:sendSpeed')}
            description={t('settings:sendSpeedDescription')}
            valueLabel={t('settings:wpmValue', { value: wpm })}
            onDecrease={() => setWpm(Math.max(MIN_WPM, wpm - WPM_STEP))}
            onIncrease={() => setWpm(Math.min(MAX_WPM, wpm + WPM_STEP))}
            decreaseLabel={t('settings:decreaseSendSpeed')}
            increaseLabel={t('settings:increaseSendSpeed')}
          />

          <StepperRow
            title={t('settings:signalTolerance')}
            description={t('settings:signalToleranceDescription')}
            valueLabel={t('settings:percentValue', { value: signalTolerancePercent })}
            onDecrease={() =>
              setSignalTolerancePercent(Math.max(MIN_PERCENT, signalTolerancePercent - PERCENT_STEP))
            }
            onIncrease={() =>
              setSignalTolerancePercent(Math.min(MAX_PERCENT, signalTolerancePercent + PERCENT_STEP))
            }
            decreaseLabel={t('settings:decreaseSignalTolerance')}
            increaseLabel={t('settings:increaseSignalTolerance')}
          />

          <StepperRow
            title={t('settings:gapTolerance')}
            description={t('settings:gapToleranceDescription')}
            valueLabel={t('settings:percentValue', { value: gapTolerancePercent })}
            onDecrease={() => setGapTolerancePercent(Math.max(MIN_PERCENT, gapTolerancePercent - PERCENT_STEP))}
            onIncrease={() => setGapTolerancePercent(Math.min(MAX_PERCENT, gapTolerancePercent + PERCENT_STEP))}
            decreaseLabel={t('settings:decreaseGapTolerance')}
            increaseLabel={t('settings:increaseGapTolerance')}
          />

          <StepperRow
            title={t('settings:tonePitch')}
            description={t('settings:tonePitchDescription')}
            valueLabel={t('settings:hzValue', { value: toneHz })}
            onDecrease={() => setToneHz(Math.max(MIN_HZ, toneHz - HZ_STEP))}
            onIncrease={() => setToneHz(Math.min(MAX_HZ, toneHz + HZ_STEP))}
            decreaseLabel={t('settings:decreaseTonePitch')}
            increaseLabel={t('settings:increaseTonePitch')}
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
            <Text style={[styles.rowSubtitle, { color: '#FF3B30' }]}>Clears all lesson/review/challenge completion</Text>
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
                  {isSelected && <Text style={styles.languageOptionCheck}>âœ“</Text>}
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
    //marginBottom: theme.spacing(3),
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
/*     modalCard: {
    width: '86%',
    backgroundColor: theme.colors?.cardBg ?? '#101214',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors?.border ?? '#2A2F36',
  },
  modalTitle: { color: '#fff', fontWeight: '800', fontSize: 18, marginBottom: 8 },
  modalText: { color: '#D0D4DA', fontSize: 14 },
  modalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2F36',
  }, */
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalBtnText: { color: '#D0D4DA', fontWeight: '700' },
});

