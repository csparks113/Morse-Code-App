import { StyleSheet } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme/lessonTheme';
import { theme } from '@/theme/theme';
import { typography, fontWeight } from '@/theme/tokens';

const sessionStyleDefs = {
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: spacing(3),
    justifyContent: 'space-between',
  },
  topGroup: { marginBottom: spacing(0.5) },
  centerGroup: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottomGroup: { marginTop: spacing(0.5), alignItems: 'stretch' },
  togglesWrap: { alignSelf: 'stretch', minHeight: 64, justifyContent: 'center' },
  inputZone: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', minHeight: 140 },
  lessonChoices: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing(2) },
  summaryContainer: { flex: 1, paddingHorizontal: spacing(3), paddingTop: spacing(2), paddingBottom: spacing(2) },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(4),
    padding: spacing(4),
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

