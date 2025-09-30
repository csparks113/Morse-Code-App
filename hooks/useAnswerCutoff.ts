// hooks/useAnswerCutoff.ts
import * as React from 'react';

/**
 * Fires onTimeout if there's been no new input for `cutoffMs`
 * since the last press end time. Resets whenever `answerKey` changes.
 */
export function useAnswerCutoff(params: {
  answerKey: string;           // unique per question
  lastPressEndMs: number | null;
  cutoffMs: number;            // e.g., 3 * unitMs * 1.5
  onTimeout: () => void;
}) {
  const { answerKey, lastPressEndMs, cutoffMs, onTimeout } = params;
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [answerKey]);

  React.useEffect(() => {
    if (lastPressEndMs == null) return;
    if (cutoffMs <= 0) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onTimeout(), cutoffMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [lastPressEndMs, cutoffMs, onTimeout]);
}
