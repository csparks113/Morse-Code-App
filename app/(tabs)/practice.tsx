
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';

import SessionHeader from '@/components/session/SessionHeader';
import { sessionStyleSheet, sessionContainerPadding } from '@/theme/sessionStyles';
import { colors as lessonColors, surfaces, radii, spacing, sessionLayoutTheme } from '@/theme/lessonTheme';
import { typography, fontWeight } from '@/theme/tokens';

type PracticeSection = {
  key: string;
  labelKey: string;
  subtitleKey: string;
  href?: '/practice/keyer';
};

const PRACTICE_SECTIONS: PracticeSection[] = [
  { key: 'keyerLab', labelKey: 'keyerLab', subtitleKey: 'keyerLabDescription', href: '/practice/keyer' },
  { key: 'customPractice', labelKey: 'customPractice', subtitleKey: 'comingSoon' },
  { key: 'timingPractice', labelKey: 'timingPractice', subtitleKey: 'comingSoon' },
];

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
          <Text style={styles.subtitle}>{t('intro')}</Text>
        </View>

        <View style={[sessionStyleSheet.centerGroup, styles.sectionsWrap]}>
          {PRACTICE_SECTIONS.map((section) => {
            const title = t(section.labelKey);
            const subtitle = t(section.subtitleKey);
            const content = (
              <>
                <Text style={styles.sectionTitle}>{title}</Text>
                <Text style={styles.sectionSubtitle}>{subtitle}</Text>
              </>
            );

            if (section.href) {
              return (
                <Link key={section.key} href={section.href} asChild>
                  <Pressable style={({ pressed }) => [styles.section, styles.interactiveSection, pressed && styles.sectionPressed]}>
                    {content}
                  </Pressable>
                </Link>
              );
            }

            return (
              <View key={section.key} style={styles.section}>
                {content}
              </View>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: lessonColors.textDim,
    marginTop: spacing(sessionLayoutTheme.summary.content.subLabelMarginTopStep),
    fontSize: typography.body,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  sectionsWrap: {
    alignSelf: 'stretch',
    width: '100%',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    gap: spacing(sessionLayoutTheme.summary.standalone.gapStep),
  },
  section: {
    backgroundColor: surfaces.card,
    borderRadius: radii.xl,
    padding: spacing(sessionLayoutTheme.summary.standalone.paddingHorizontalStep),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: lessonColors.border,
    gap: spacing(1),
  },
  interactiveSection: {
    borderWidth: 2,
    borderColor: lessonColors.blueNeon,
    shadowColor: lessonColors.blueNeon,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  sectionPressed: {
    backgroundColor: surfaces.pressed,
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
