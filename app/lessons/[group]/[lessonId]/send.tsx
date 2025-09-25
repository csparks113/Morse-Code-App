// app/lessons/[group]/[lessonId]/send.tsx
/**
 * SEND SESSION SCREEN (Pinned layout)
 * -----------------------------------
 * Visual + layout now mirrors RECEIVE:
 * - Top:    SessionHeader + ProgressBar (tight gap)
 * - Center: PromptCard (only moving part; centered vertically)
 * - Bottom: OutputTogglesRow above Keyer button
 *
 * Outputs tied to keyer:
 * - Press-in: tone + held flash + haptics
 * - Press-out: stop tone + fade flash + stop haptics
 *
 * Compare view:
 * - While guessing: user-only MorseTimeline
 * - After correct OR if revealed: RevealBar compare (target vs user)
 */

import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";

// Shared, presentational UI building blocks (no business logic inside)
import SessionHeader from "@/components/session/SessionHeader";
import ProgressBar from "@/components/session/ProgressBar";
import SessionSummary from "@/components/session/SessionSummary";
import PromptCard from "@/components/session/PromptCard";
import OutputTogglesRow from "@/components/session/OutputTogglesRow";
import KeyerButton from "@/components/session/KeyerButton";
import FlashOverlay from "@/components/session/FlashOverlay";
import MorseCompare from "@/components/session/MorseCompare";

// Theme tokens and Morse helpers
import { colors, spacing } from "@/theme/lessonTheme";
import { theme } from "@/theme/theme";
import { toMorse } from "@/utils/morse";
import {
  classifyGapDuration,    // map a measured gap into intra/inter/word (or null)
  classifySignalDuration, // map a press length into '.' / '-' (or null)
  getMorseUnitMs,         // current dot unit in ms (derived from Settings)
} from "@/utils/morseTiming";

// App state + reusable hooks
import { useProgressStore } from "@/store/useProgressStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useKeyerOutputs } from "@/hooks/useKeyerOutputs"; // encapsulates audio/haptics/flash side-effects
import { useSessionFlow } from "@/hooks/useSessionFlow";   // orchestrates questions/results/summary

// Builds lesson metadata (pool, titles, etc.)
import { buildSessionMeta } from "./sessionMeta";

const TOTAL_QUESTIONS = 20; // session length

type FeedbackState = "idle" | "correct" | "wrong";
type PressWindow = { startMs: number; endMs: number };

export default function SendSessionScreen() {
  // -----------------------------
  // 1) ROUTE & LESSON BOOTSTRAP
  // -----------------------------
  // Grab the current lesson identifiers from the route, then create the
  // "meta" descriptor (includes the question pool, header labels, etc.)
  const { group, lessonId } = useLocalSearchParams<{
    group: string;
    lessonId: string;
  }>();

  const meta = React.useMemo(
    () => buildSessionMeta(group || "alphabet", lessonId),
    [group, lessonId],
  );

  // Write back the final score when the session completes
  const setScore = useProgressStore((s) => s.setScore);

  // -----------------------------
  // 2) USER SETTINGS (OUTPUTS)
  // -----------------------------
  // These flags control whether audio, screen flash, torch, or haptics
  // should activate when the keyer is pressed, plus the audio tone frequency.
  const settings = useSettingsStore();
  const {
    audioEnabled,
    lightEnabled,
    torchEnabled,
    hapticsEnabled,
    setAudioEnabled,
    setLightEnabled,
    setTorchEnabled,
    setHapticsEnabled,
    toneHz,
  } = settings;

  // Tolerances govern how strict we are when classifying presses & gaps
  const signalTolerancePercent =
    typeof settings.signalTolerancePercent === "number"
      ? settings.signalTolerancePercent
      : 30;
  const gapTolerancePercent =
    typeof settings.gapTolerancePercent === "number"
      ? settings.gapTolerancePercent
      : 50;

  const signalTolerance = signalTolerancePercent / 100;
  const gapTolerance = gapTolerancePercent / 100;

  // Normalize toneHz to a sane, numeric value with fallback
  const toneHzValue = React.useMemo(() => {
    const parsed = Number(toneHz);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 600;
  }, [toneHz]);

  // -----------------------------
  // 3) SESSION ORCHESTRATION
  // -----------------------------
  // useSessionFlow manages the list of questions, the streak, results,
  // and the computed summary. We just push "correct/incorrect" into it.
  const {
    started,
    summary,
    start,          // begin a fresh session
    results,
    streak,
    currentTarget,  // the current letter/number user needs to key
    setResult,      // push result for current question (true/false)
  } = useSessionFlow({
    pool: meta.pool,
    total: TOTAL_QUESTIONS,
    onFinished: ({ percent }) => {
      // On completion, persist a score record for this lesson
      if (group && lessonId) {
        setScore(group, lessonId, "send", percent);
      }
    },
  });

  // -----------------------------
  // 4) OUTPUT SIDE EFFECTS HOOK
  // -----------------------------
  // This encapsulates tone/haptics/flash behavior for keyer presses.
  // - onDown(): press-in effects (start tone, start haptics, flash -> 1)
  // - onUp():   release effects (stop tone, stop haptics, flash -> fade out)
  // - flashOpacity: Animated.Value 0..1, rendered by <FlashOverlay />
  // - prepare/teardown: audio warm-up and cleanup
  const { onDown, onUp, flashOpacity, prepare, teardown } = useKeyerOutputs({
    audioEnabled,
    hapticsEnabled,
    lightEnabled,
    toneHz: toneHzValue,
  });

  // Warm up audio buffers etc. at mount/focus
  React.useEffect(() => {
    prepare().catch(() => {});
  }, [prepare]);

  // Cleanup at unmount (stop sound, timers, etc.)
  React.useEffect(() => {
    return () => {
      teardown().catch(() => {});
    };
  }, [teardown]);

  // -----------------------------
  // 5) LOCAL VIEW STATE
  // -----------------------------
  // feedback: drives UI accents (e.g., red bar on "wrong")
  // showReveal: whether to show the compare bar before "correct"
  // inputRef + setInput: the typed morse so far ("." and "-")
  // presses: raw press windows for the timeline visualization
  const [feedback, setFeedback] = React.useState<FeedbackState>("idle");
  const [showReveal, setShowReveal] = React.useState(false);
  const [, setInput] = React.useState("");
  const [presses, setPresses] = React.useState<PressWindow[]>([]);

  // Keep the input string in a ref so we can read synchronously inside handlers
  const inputRef = React.useRef("");
  const updateInput = React.useCallback((next: string) => {
    inputRef.current = next;
    setInput(next);
  }, []);

  // Cache the current target's Morse string for fast prefix checks
  const currentMorseRef = React.useRef("");

  // Refs to track press timing and cross-press validation state
  const pressStartRef = React.useRef<number | null>(null);
  const lastReleaseRef = React.useRef<number | null>(null);
  const ignorePressRef = React.useRef(false);
  const advanceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Clear any pending "advance to next question" timer if we unmount early
  React.useEffect(() => {
    return () => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, []);

  // -----------------------------
  // 6) RESPONSIVE LAYOUT METRICS
  // -----------------------------
  // We compute a screen-size bucket to keep the PromptCard and Keyer sizes
  // feeling balanced on small devices.
  const screenH = Dimensions.get("window").height;
  const layout = screenH < 635 ? "xsmall" : screenH < 700 ? "small" : "regular";
  const promptSlotHeight =
    layout === "regular" ? 116 : layout === "small" ? 96 : 84;
  const keyerMinHeight =
    layout === "regular" ? 128 : layout === "small" ? 104 : 92;

  // Compute the canonical Morse for the current target (e.g., "K" -> "-.-")
  const currentMorse = currentTarget ? toMorse(currentTarget) ?? "" : "";
  currentMorseRef.current = currentMorse;

  // The dot-unit in ms (user-adjustable WPM); used both for classification
  // and for drawing the timeline/compare visualizations with the right scale.
  const unitMs = getMorseUnitMs();
  const wpm = unitMs > 0 ? 1200 / unitMs : 12;

  // -----------------------------
  // 7) SESSION CONTROLS
  // -----------------------------
  // Start a new session; clear any state that should reset between runs.
  const startSession = React.useCallback(() => {
    if (!meta.pool.length) return;
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }

    start();            // tell useSessionFlow to (re)generate questions
    updateInput("");    // clear current morse input
    setPresses([]);     // clear visualization
    setShowReveal(false);
    setFeedback("idle");

    // Reset timing refs so the first press isn't contaminated by stale data
    pressStartRef.current = null;
    lastReleaseRef.current = null;
    ignorePressRef.current = false;
  }, [meta.pool, start, updateInput]);

  // Finish the current question:
  // - show instant feedback (correct/wrong)
  // - after a brief pause, push the result to useSessionFlow and advance
  const finishQuestion = React.useCallback(
    (isCorrect: boolean) => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }

      setFeedback(isCorrect ? "correct" : "wrong");
      if (isCorrect) setShowReveal(true); // show compare bar on success

      // reset low-level timing refs before the next item
      ignorePressRef.current = false;
      pressStartRef.current = null;
      lastReleaseRef.current = null;

      // small delay so users can register the feedback, then advance
      advanceTimerRef.current = setTimeout(() => {
        setResult(isCorrect); // increments progress, handles summary if last
        updateInput("");
        setPresses([]);
        setShowReveal(false);
        setFeedback("idle");
        advanceTimerRef.current = null;
      }, 650);
    },
    [setResult, updateInput],
  );

  // Append a "." or "-" to the current input and evaluate against target.
  // If the prefix deviates, it's instantly wrong; if it fully matches, it's correct.
  const appendSymbol = React.useCallback(
    (symbol: "." | "-") => {
      if (!currentTarget) return;
      const targetMorse = currentMorseRef.current;
      const next = `${inputRef.current}${symbol}`;
      updateInput(next);

      if (!targetMorse.startsWith(next)) {
        // user deviated from correct sequence
        finishQuestion(false);
        return;
      }

      if (targetMorse === next) {
        // user finished the character exactly
        finishQuestion(true);
      }
    },
    [currentTarget, finishQuestion, updateInput],
  );

  // -----------------------------
  // 8) KEYER HANDLERS
  // -----------------------------
  // Press-in rules:
  // - Must be in an interactive moment (session in progress, no summary, etc.)
  // - If we already typed at least one element, then the gap before this press
  //   must be an "intra-character" gap (1 unit). Otherwise it's a mistake.
  // - If valid, begin a new press window and trigger outputs (onDown()).
  const onPressIn = React.useCallback(() => {
    if (!started || summary || !currentTarget || feedback !== "idle") return;

    const now = Date.now();

    // Validate gap from the last release if we've already entered something
    if (inputRef.current.length > 0 && lastReleaseRef.current !== null) {
      const gapDuration = now - lastReleaseRef.current;
      const gapType = classifyGapDuration(gapDuration, unitMs, gapTolerance);

      // Only intra-character gaps are allowed between elements within a letter
      if (gapType !== "intra") {
        // mark wrong and ignore the duration of this "press" (it's not valid)
        ignorePressRef.current = true;
        lastReleaseRef.current = null;
        finishQuestion(false);
        return;
      }
    }

    // Start a valid press
    ignorePressRef.current = false;
    pressStartRef.current = now;

    // Fire outputs (tone/haptics/flash). These are decoupled from classification.
    onDown();
  }, [started, summary, currentTarget, feedback, unitMs, gapTolerance, finishQuestion, onDown]);

  // Press-out rules:
  // - Turn outputs off first (onUp()) so the UI feels snappy.
  // - If this release shouldn't count (ignorePressRef), bail.
  // - Otherwise, measure duration -> classify -> append symbol or fail.
  const onPressOut = React.useCallback(() => {
    onUp(); // stop tone/haptics, start flash fade-out immediately

    // If we can't interact (paused/finished), just reset transient refs
    if (!started || summary || !currentTarget || feedback !== "idle") {
      ignorePressRef.current = false;
      pressStartRef.current = null;
      return;
    }

    // The previous "press-in" was invalidated (wrong gap), so ignore this one
    if (ignorePressRef.current) {
      ignorePressRef.current = false;
      pressStartRef.current = null;
      return;
    }

    const startAt = pressStartRef.current;
    pressStartRef.current = null;
    if (!startAt) {
      // defensive: if we somehow missed recording press start, do nothing
      return;
    }

    const releaseAt = Date.now();
    const duration = releaseAt - startAt;

    // Save the raw press window for the timeline visualization
    setPresses((prev) => [...prev, { startMs: startAt, endMs: releaseAt }]);

    // Classify press length into dot/dash given the current unit and tolerance
    const symbol = classifySignalDuration(duration, unitMs, signalTolerance);
    if (!symbol) {
      // Could not classify (too long/short); it's a wrong answer
      lastReleaseRef.current = null;
      finishQuestion(false);
      return;
    }

    // Store the release time so the next press can validate the gap
    lastReleaseRef.current = releaseAt;

    // Append "." or "-" and evaluate against target
    appendSymbol(symbol);
  }, [started, summary, currentTarget, feedback, appendSymbol, finishQuestion, unitMs, signalTolerance, onUp]);

  // Whether the UI should allow input at this moment
  const canInteract =
    started && !summary && !!currentTarget && feedback === "idle";

  // When closing the screen early, clear any pending timers
  const handleCloseCleanup = React.useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  // -----------------------------
  // 9) EARLY RETURNS (EMPTY / SUMMARY)
  // -----------------------------
  if (!meta.pool.length) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Content unavailable.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (summary) {
    return (
      <SafeAreaView style={styles.safe}>
        <SessionSummary
          percent={summary.percent}
          correct={summary.correct}
          total={TOTAL_QUESTIONS}
          onContinue={handleCloseCleanup}
        />
      </SafeAreaView>
    );
  }

  // -----------------------------
  // 10) RENDER (Pinned layout)
  // -----------------------------
  // Visual accents for compare bar:
  const bottomBarColor = feedback === "wrong" ? "#FF6B6B" : colors.gold;
  const compareMode =
    showReveal || feedback === "correct" ? "compare" : "guessing";

  return (
    <SafeAreaView style={styles.safe}>
      {/* Full-screen flash overlay, driven by useKeyerOutputs' Animated.Value */}
      <FlashOverlay opacity={flashOpacity} color={colors.text} maxOpacity={0.28} />

      <View style={styles.container}>
        {/* TOP: header + progress (tight spacing to match Receive) */}
        <View style={styles.topGroup}>
          <SessionHeader
            labelTop={meta.headerTop}
            labelBottom="SEND"
            onClose={handleCloseCleanup}
          />
          <ProgressBar
            value={results.length}
            total={TOTAL_QUESTIONS}
            streak={streak}
          />
        </View>

        {/* CENTER: PromptCard is vertically centered; only moving piece */}
        <View style={styles.centerGroup}>
          <PromptCard
            compact
            revealSize="sm"
            title="Tap to key the Morse code"
            started={started}
            visibleChar={started ? currentTarget ?? "" : ""}
            feedback={feedback}
            morse="" // text reveal suppressed (visual compare handles this)
            showReveal={showReveal}
            canInteract={canInteract}
            onStart={startSession}
            onRevealToggle={() => setShowReveal((prev) => !prev)}
            onReplay={() => {}} // Send has keyer-driven output; no "replay"
            mainSlotMinHeight={promptSlotHeight}
            belowReveal={
              // Compare block toggles between timeline (guessing) and
              // target vs user overlay (compare) while keeping sizing consistent
              <MorseCompare
                mode={compareMode}
                char={currentTarget ?? undefined}
                presses={presses}
                wpm={wpm}
                size="md"
                topColor={colors.blueNeon}
                bottomColor={bottomBarColor}
                align="center"
              />
            }
          />
        </View>

        {/* BOTTOM: Output toggles sit directly above the keyer button */}
        <View style={styles.bottomGroup}>
          <View style={styles.togglesWrap}>
            <OutputTogglesRow
              hapticsEnabled={hapticsEnabled}
              lightEnabled={lightEnabled}
              audioEnabled={audioEnabled}
              torchEnabled={torchEnabled}
              setHapticsEnabled={setHapticsEnabled}
              setLightEnabled={setLightEnabled}
              setAudioEnabled={setAudioEnabled}
              setTorchEnabled={setTorchEnabled}
            />
          </View>

          <KeyerButton
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={!canInteract}
            minHeight={keyerMinHeight}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

// -----------------------------
// 11) STYLES (parity with Receive)
// -----------------------------
const styles = StyleSheet.create({
  // App background
  safe: { flex: 1, backgroundColor: theme.colors.background },

  // The pinned layout frame with consistent horizontal/vertical padding
  container: {
    flex: 1,
    paddingHorizontal: spacing(3),
    paddingTop: spacing(2),
    paddingBottom: spacing(2),
  },

  // Small gap between header and progress bar (matches Receive)
  topGroup: { marginBottom: spacing(0.5) },

  // Center the PromptCard in the available space
  centerGroup: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Bottom stack: toggles (small gap) then keyer
  bottomGroup: { marginTop: spacing(0.5), alignItems: "stretch" },

  // Keep toggles vertically centered and reserved in height
  togglesWrap: {
    alignSelf: "stretch",
    minHeight: 64,
    justifyContent: "center",
    marginBottom: spacing(2),
  },

  // Fallback empty state if the lesson pool is missing
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(4),
    padding: spacing(4),
  },
  emptyText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
});
