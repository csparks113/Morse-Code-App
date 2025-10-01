import React from "react";

/**
 * SessionSummary
 * ---------------
 * Compact result snapshot returned at the end of a session.
 * - correct: number of correct answers
 * - percent: rounded score percentage (0..100)
 */
type SessionSummary = {
  correct: number;
  percent: number;
};

/**
 * UseSessionFlowOptions
 * ---------------------
 * pool:   the set of glyphs/characters to draw questions from
 * total:  number of questions per session (defaults to 20)
 * onFinished: callback invoked once the session completes
 */
type UseSessionFlowOptions = {
  pool: string[];
  total?: number;
  onFinished?: (summary: SessionSummary) => void;
};

/**
 * UseSessionFlowResult
 * --------------------
 * started:       whether a session is currently running
 * summary:       final results (null until complete)
 * start():       (re)starts a session and generates questions
 * results:       boolean array of per-question correctness
 * streak:        current streak of consecutive correct answers
 * currentIndex:  zero-based index of the current question
 * currentTarget: the glyph to answer right now (or null if idle)
 * setResult():   push the result for the current question
 * reset():       hard reset to idle (clears questions/results)
 */
type UseSessionFlowResult = {
  started: boolean;
  summary: SessionSummary | null;
  start: () => void;
  results: boolean[];
  streak: number;
  currentIndex: number;
  currentTarget: string | null;
  setResult: (isCorrect: boolean) => void;
  reset: () => void;
};

const DEFAULT_TOTAL = 20;

/**
 * useSessionFlow
 * --------------
 * A small state machine for lesson/challenge sessions:
 * - Generates a fixed-length list of questions from the provided pool.
 * - Tracks per-question correctness and a running streak.
 * - Emits a summary (correct count + percent) on completion.
 *
 * Design notes:
 * - Question selection is **with replacement** (duplicates allowed) so the
 *   distribution remains simple and fast; adjust if you need uniqueness.
 * - The hook is UI-agnostic: it doesn't time answers or judge them — it only
 *   records a boolean result per question and advances the index.
 */
export function useSessionFlow({
  pool,
  total = DEFAULT_TOTAL,
  onFinished,
}: UseSessionFlowOptions): UseSessionFlowResult {
  // Session lifecycle flags and aggregates
  const [started, setStarted] = React.useState(false);
  const [questions, setQuestions] = React.useState<string[]>([]);
  const [results, setResults] = React.useState<boolean[]>([]);
  const [summary, setSummary] = React.useState<SessionSummary | null>(null);
  const [streak, setStreak] = React.useState(0);

  // Clamp/normalize the requested question count
  const totalQuestions = Math.max(1, Math.floor(total));

  // The current question index is simply the number of results recorded so far
  const currentIndex = results.length;

  // If a session is active, surface the current target; else null
  const currentTarget = started ? questions[currentIndex] ?? null : null;

  /**
   * generateQuestions()
   * -------------------
   * Returns an array of length `totalQuestions`, drawing each entry
   * uniformly at random from `pool`. If the pool is empty, returns [].
   * (Duplicates are possible/likely; this is intentional and fast.)
   */
  const generateQuestions = React.useCallback(() => {
    if (!pool.length) return [];
    const generated: string[] = [];
    for (let i = 0; i < totalQuestions; i += 1) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      generated.push(pick);
    }
    return generated;
  }, [pool, totalQuestions]);

  /**
   * start()
   * -------
   * Initializes a new session:
   * - builds a fresh question list
   * - clears previous results/summary/streak
   * - flips `started` to true
   */
  const start = React.useCallback(() => {
    if (!pool.length) return; // no-op if content is unavailable
    const generated = generateQuestions();
    setQuestions(generated);
    setResults([]);
    setSummary(null);
    setStreak(0);
    setStarted(true);
  }, [pool, generateQuestions]);

  /**
   * reset()
   * -------
   * Hard stop the session and clear all state. Useful when leaving a screen
   * or when you want an explicit "Reset" button separate from "Start".
   */
  const reset = React.useCallback(() => {
    setStarted(false);
    setQuestions([]);
    setResults([]);
    setSummary(null);
    setStreak(0);
  }, []);

  /**
   * setResult(isCorrect)
   * --------------------
   * Records the result for the current question and advances the index.
   * On the final question, computes and publishes the summary, ends the
   * session (started=false), and invokes `onFinished` if provided.
   *
   * Implementation detail:
   * - We compute `didAdvance` alongside the state update so we can update
   *   `streak` in the same tick without reading stale state.
   */
  const setResult = React.useCallback(
    (isCorrect: boolean) => {
      let didAdvance = false;
      setResults((prev) => {
        if (prev.length >= totalQuestions) return prev; // guard: already done
        const next = [...prev, isCorrect];
        didAdvance = true;

        // If this was the final answer, finalize the session
        if (next.length === totalQuestions) {
          const correctCount = next.filter(Boolean).length;
          const percent = totalQuestions > 0
            ? Math.round((correctCount / totalQuestions) * 100)
            : 0;

          const summaryValue: SessionSummary = { correct: correctCount, percent };
          setSummary(summaryValue);
          setStarted(false);
        }
        return next;
      });

      // Update streak after we know we advanced (avoids double-increment)
      if (didAdvance) {
        setStreak((prev) => (isCorrect ? prev + 1 : 0));
      }
    },
    [totalQuestions],
  );

  const lastSummaryRef = React.useRef<SessionSummary | null>(null);
  React.useEffect(() => {
    if (!summary || !onFinished) return;
    if (lastSummaryRef.current === summary) return;
    lastSummaryRef.current = summary;
    onFinished(summary);
  }, [summary, onFinished]);
  // Public API
  return {
    started,
    summary,
    start,
    results,
    streak,
    currentIndex,
    currentTarget,
    setResult,
    reset,
  };
}
