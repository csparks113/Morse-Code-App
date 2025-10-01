import type React from 'react';

import type ActionButton from '@/components/session/ActionButton';
import type { ActionButtonState } from '@/components/session/ActionButton';

/**
 * Localized accessibility labels for prompt-level actions.
 * Provide translated strings that describe the reveal/replay buttons for screen readers.
 *
 * @example
 * const labels: PromptActionLabels = {
 *   reveal: t('session:reveal'),
 *   replay: t('session:replay'),
 * };
 */
export type PromptActionLabels = {
  reveal: string;
  replay: string;
};

export type SessionActionIconName = React.ComponentProps<typeof ActionButton>['icon'];

/**
 * Shape of the prompt action object consumed by session UIs.
 * Pair the icon + accessible label with the callback and state returned from the hooks.
 */
export type PromptActionConfig = {
  icon: SessionActionIconName;
  accessibilityLabel: string;
  onPress: () => void;
  state: ActionButtonState;
};
