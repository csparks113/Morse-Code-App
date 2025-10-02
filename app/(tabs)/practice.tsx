import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import SessionHeader from '@/components/session/SessionHeader';
import { sessionStyleSheet, sessionContainerPadding } from '@/theme/sessionStyles';
import { colors as lessonColors, surfaces, radii, spacing, sessionLayoutTheme } from '@/theme/lessonTheme';
import { typography, fontWeight } from '@/theme/tokens';

const PRACTICE_SECTIONS = ['customPractice', 'timingPractice'] as const;
const summaryLayout = sessionLayoutTheme.summary;
const summaryStandalone = summaryLayout.standalone;
const summaryContentLayout = summaryLayout.content;

type PracticeSectionKey = (typeof PRACTICE_SECTIONS)[number];

export default function PracticeScreen() {
  const { t } = useTranslation('practice');
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={sessionStyleSheet.safe} edges={['top']}>
      <View
        style={[
          sessionStyleSheet.container,
          sessionContainerPadding(insets, { footerVariant: 'practice' }),
        ]}
      >
        <View style={sessionStyleSheet.topGroup}>
          <SessionHeader
            labelTop={t('title')}
            labelBottom="PRACTICE"
            showCloseButton={false}
            exitToHome={false}
          />
          <Text style={styles.subtitle}>{t('comingSoon')}</Text>
        </View>

        <View style={[sessionStyleSheet.centerGroup, styles.sectionsWrap]}>
          {PRACTICE_SECTIONS.map((key: PracticeSectionKey) => (
            <View key={key} style={styles.section}>
              <Text style={styles.sectionTitle}>{t(key)}</Text>
              <Text style={styles.sectionSubtitle}>{t('comingSoon')}</Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: lessonColors.textDim,
    marginTop: spacing(summaryContentLayout.subLabelMarginTopStep),
    fontSize: typography.body,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  sectionsWrap: {
    alignSelf: 'stretch',
    width: '100%',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    gap: spacing(summaryStandalone.gapStep),
  },
  section: {
    backgroundColor: surfaces.card,
    borderRadius: radii.xl,
    padding: spacing(summaryStandalone.paddingHorizontalStep),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: lessonColors.border,
    gap: spacing(1),
  },
  sectionTitle: {
    color: lessonColors.text,
    fontSize: typography.subtitle,
    fontWeight: fontWeight.bold,
  },
  sectionSubtitle: {
    color: lessonColors.textDim,
    fontSize: typography.body,
  },
});
