import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { theme } from '../../theme/theme';

const PRACTICE_SECTIONS = ['customPractice', 'timingPractice'] as const;

type PracticeSectionKey = (typeof PRACTICE_SECTIONS)[number];

export default function PracticeScreen() {
  const { t } = useTranslation('practice');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title} numberOfLines={2}>
          {t('title')}
        </Text>
        <View style={styles.headerDivider} />
        <Text style={styles.subtitle}>{t('comingSoon')}</Text>

        {PRACTICE_SECTIONS.map((key: PracticeSectionKey) => (
          <View key={key} style={styles.section}>
            <Text style={styles.sectionTitle}>{t(key)}</Text>
            <Text style={styles.sectionSubtitle}>{t('comingSoon')}</Text>
          </View>
        ))}
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
    textAlign: 'auto',
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  subtitle: {
    color: theme.colors.muted,
    textAlign: 'auto',
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing(4),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    gap: theme.spacing(1),
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    textAlign: 'auto',
  },
  sectionSubtitle: {
    color: theme.colors.muted,
    fontSize: theme.typography.small,
    textAlign: 'auto',
  },
});
