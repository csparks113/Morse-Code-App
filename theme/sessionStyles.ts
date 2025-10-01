import { StyleSheet } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { colors, spacing, sessionLayoutTheme } from '@/theme/lessonTheme';
import { theme } from '@/theme/theme';
import { typography, fontWeight } from '@/theme/tokens';

const sessionStyleDefs = {
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: spacing(sessionLayoutTheme.container.paddingHorizontalStep),
    justifyContent: 'space-between',
  },
  topGroup: { marginBottom: spacing(sessionLayoutTheme.groups.verticalGapStep) },
  centerGroup: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottomGroup: {
    marginTop: spacing(sessionLayoutTheme.groups.verticalGapStep),
    alignItems: 'stretch',
  },
  togglesWrap: {
    alignSelf: 'stretch',
    minHeight: sessionLayoutTheme.toggles.minHeight,
    justifyContent: 'center',
  },
  inputZone: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: sessionLayoutTheme.inputZone.minHeight,
  },
  lessonChoices: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing(2) },
  summaryContainer: {
    flex: 1,
    paddingHorizontal: spacing(sessionLayoutTheme.summary.paddingHorizontalStep),
    paddingTop: spacing(sessionLayoutTheme.summary.paddingTopStep),
    paddingBottom: spacing(sessionLayoutTheme.summary.paddingBottomStep),
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(sessionLayoutTheme.emptyState.gapStep),
    padding: spacing(sessionLayoutTheme.emptyState.paddingStep),
  },
  emptyText: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: fontWeight.bold,
  },
} as const;

export const sessionContainerPadding = (insets: EdgeInsets, topExtra = 0, bottomExtra = 0) => ({
  paddingTop: insets.top + topExtra,
  paddingBottom: insets.bottom + bottomExtra,
});

export const sessionStyles = sessionStyleDefs;
export const sessionStyleSheet = StyleSheet.create(sessionStyleDefs);
