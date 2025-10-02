import { StyleSheet } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { colors, spacing, sessionLayoutTheme } from '@/theme/lessonTheme';
import { theme } from '@/theme/theme';
import { typography, fontWeight } from '@/theme/tokens';

type SessionFooterVariant = keyof typeof sessionLayoutTheme.footer.paddingStep;

interface SessionPaddingOptions {
  topStep?: number;
  topPx?: number;
  footerVariant?: SessionFooterVariant;
  bottomStep?: number;
  bottomPx?: number;
}

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
  lessonChoices: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing(sessionLayoutTheme.choices.gridGapStep),
  },
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

export const sessionContainerPadding = (
  insets: EdgeInsets,
  optionsOrTopExtra?: SessionPaddingOptions | number,
  legacyBottomExtra?: number,
) => {
  if (typeof optionsOrTopExtra === 'number' || typeof legacyBottomExtra === 'number') {
    const topExtra = typeof optionsOrTopExtra === 'number' ? optionsOrTopExtra : 0;
    const bottomExtra = typeof legacyBottomExtra === 'number' ? legacyBottomExtra : 0;

    return {
      paddingTop: insets.top + topExtra,
      paddingBottom: insets.bottom + bottomExtra,
    };
  }

  const options = optionsOrTopExtra ?? {};
  const topExtra =
    options.topPx ?? (options.topStep !== undefined ? spacing(options.topStep) : 0);

  const bottomExtra =
    options.bottomPx ??
    (options.footerVariant !== undefined
      ? spacing(sessionLayoutTheme.footer.paddingStep[options.footerVariant])
      : options.bottomStep !== undefined
        ? spacing(options.bottomStep)
        : 0);

  return {
    paddingTop: insets.top + topExtra,
    paddingBottom: insets.bottom + bottomExtra,
  };
};

export const getSessionFooterSpacing = (variant: SessionFooterVariant = 'standard') =>
  spacing(sessionLayoutTheme.footer.paddingStep[variant]);

export const sessionStyles = sessionStyleDefs;
export const sessionStyleSheet = StyleSheet.create(sessionStyleDefs);
