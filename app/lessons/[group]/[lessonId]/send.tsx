// app/lessons/[group]/[lessonId]/send.tsx
/**
 * SEND SESSION SCREEN (Pinned layout)
 * -----------------------------------
 * Visual + layout mirrors RECEIVE:
 * - Top:    SessionHeader + ProgressBar
 * - Center: PromptCard
 * - Bottom: OutputTogglesRow above Keyer button
 *
 * Review behavior:
 * - Header shows "Review" (from sessionMeta)
 * - Reveal toggle ENABLED; no hearts
 * - Pool is cumulative via sessionMeta
 *
 * Challenge behavior:
 * - Header shows hearts (3)
 * - Reveal toggle DISABLED; no replay
 * - Hearts decrement on mistakes; graceful early end on 3rd miss
 */

import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";

// Shared UI
import SessionHeader from "@/components/session/SessionHeader";
import ProgressBar from "@/components/session/ProgressBar";
import SessionSummary from "@/components/session/SessionSummary";
import PromptCard from "@/components/session/PromptCard";
import OutputTogglesRow from "@/components/session/OutputTogglesRow";
import KeyerButton from "@/components/session/KeyerButton";
import FlashOverlay from "@/components/session/FlashOverlay";
import MorseCompare from "@/components/session/MorseCompare";

// Theme + helpers
import { colors, spacing } from "@/theme/lessonTheme";
import { theme } from "@/theme/theme";
import { toMorse } from "@/utils/morse";
import {
  classifyGapDuration,
  classifySignalDuration,
  getMorseUnitMs,
} from "@/utils/morseTiming";

// State/hooks
import { useProgressStore } from "@/store/useProgressStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useKeyerOutputs } from "@/hooks/useKeyerOutputs";
import { useSessionFlow } from "@/hooks/useSessionFlow";

// Meta
import { buildSessionMeta } from "./sessionMeta";

const TOTAL_QUESTIONS = 20;

type FeedbackState = "idle" | "correct" | "wrong";
type PressWindow = { startMs: number; endMs: number };

function getStoreIdForProgress(rawId: string) {
  const m = String(rawId).match(/^(\d+)-review$/);
  if (m) return m[1];          // save review scores to base lesson
  return String(rawId);        // lessons/challenges (choose to save or skip challenges)
}

export default function SendSessionScreen() {
  // -----------------------------
  // 1) ROUTE & META
  // -----------------------------
  const { group, lessonId } = useLocalSearchParams<{ group: string; lessonId: string }>();
  const meta = React.useMemo(
    () => buildSessionMeta(group || "alphabet", lessonId),
    [group, lessonId],
  );
  const isReview = React.useMemo(
    () => /^\d+-review$/.test(String(lessonId)),
    [lessonId]
  );

  const setScore = useProgressStore((s) => s.setScore);

  // -----------------------------
  // 2) SETTINGS (OUTPUTS)
  // -----------------------------
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

  const signalTolerancePercent =
    typeof settings.signalTolerancePercent === "number" ? settings.signalTolerancePercent : 30;
  const gapTolerancePercent =
    typeof settings.gapTolerancePercent === "number" ? settings.gapTolerancePercent : 50;

  const signalTolerance = signalTolerancePercent / 100;
  const gapTolerance = gapTolerancePercent / 100;

  const toneHzValue = React.useMemo(() => {
    const parsed = Number(toneHz);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 600;
  }, [toneHz]);

  // -----------------------------
  // 3) SESSION ORCHESTRATION
  // -----------------------------
  const {
    started,
    summary,            // summary from natural completion
    start,              // begin a fresh session
    results,            // boolean[] so far
    streak,
    currentTarget,      // the character to key
    setResult,          // push true/false, advances or finishes
  } = useSessionFlow({
    pool: meta.pool,
    total: TOTAL_QUESTIONS,
    onFinished: ({ percent }) => {
      if (group && lessonId) {
        setScore(group, getStoreIdForProgress(String(lessonId)), "send", percent);
      }
    },
  });

  // -----------------------------
  // 4) OUTPUT SIDE EFFECTS (keyer)
  // -----------------------------
  const { onDown, onUp, flashOpacity, prepare, teardown } = useKeyerOutputs({
    audioEnabled,
    hapticsEnabled,
    lightEnabled,
    torchEnabled,
    toneHz: toneHzValue,
  });

  React.useEffect(() => { prepare().catch(() => {}); }, [prepare]);
  React.useEffect(() => () => { teardown().catch(() => {}); }, [teardown]);

  // -----------------------------
  // 5) LOCAL VIEW STATE
  // -----------------------------
  const [feedback, setFeedback] = React.useState<FeedbackState>("idle");
  const [showReveal, setShowReveal] = React.useState(false);
  const [, setInput] = React.useState("");
  const [presses, setPresses] = React.useState<PressWindow[]>([]);

  // Challenge hearts + early summary
  const [hearts, setHearts] = React.useState(3);
  const [earlySummary, setEarlySummary] = React.useState<null | { percent: number; correct: number }>(null);

  // Input & timers
  const inputRef = React.useRef("");
  const updateInput = React.useCallback((next: string) => { inputRef.current = next; setInput(next); }, []);
  const currentMorseRef = React.useRef("");
  const pressStartRef = React.useRef<number | null>(null);
  const lastReleaseRef = React.useRef<number | null>(null);
  const ignorePressRef = React.useRef(false);
  const advanceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => { if (advanceTimerRef.current) { clearTimeout(advanceTimerRef.current); advanceTimerRef.current = null; } };
  }, []);

  // -----------------------------
  // 6) LAYOUT METRICS
  // -----------------------------
  const screenH = Dimensions.get("window").height;
  const layout = screenH < 635 ? "xsmall" : screenH < 700 ? "small" : "regular";
  const promptSlotHeight = layout === "regular" ? 116 : layout === "small" ? 96 : 84;
  const keyerMinHeight = layout === "regular" ? 128 : layout === "small" ? 104 : 92;

  // -----------------------------
  // 7) MORSE & SPEED
  // -----------------------------
  const currentMorse = currentTarget ? toMorse(currentTarget) ?? "" : "";
  currentMorseRef.current = currentMorse;

  const unitMs = getMorseUnitMs();
  const wpm = unitMs > 0 ? 1200 / unitMs : 12;

  // -----------------------------
  // 8) SESSION CONTROLS
  // -----------------------------
  const startSession = React.useCallback(() => {
    if (!meta.pool.length) return;
    if (advanceTimerRef.current) { clearTimeout(advanceTimerRef.current); advanceTimerRef.current = null; }

    start();
    updateInput("");
    setPresses([]);
    setShowReveal(false);
    setFeedback("idle");

    // Reset timing refs
    pressStartRef.current = null;
    lastReleaseRef.current = null;
    ignorePressRef.current = false;

    // Reset hearts in challenge
    if (meta.isChallenge) setHearts(3);

    // Clear any prior early summary
    setEarlySummary(null);
  }, [meta.pool, meta.isChallenge, start, updateInput]);

  // Graceful finish: keep red state visible on 3rd miss, then show summary
  const finishQuestion = React.useCallback((isCorrect: boolean) => {
    if (advanceTimerRef.current) { clearTimeout(advanceTimerRef.current); advanceTimerRef.current = null; }

    const willExhaustHearts = meta.isChallenge && !isCorrect && hearts <= 1;

    setFeedback(isCorrect ? "correct" : "wrong");
    if (isCorrect) setShowReveal(true);

    // Challenge hearts: decrement on mistakes
    if (!isCorrect && meta.isChallenge) {
      setHearts((h) => Math.max(0, h - 1));
    }

    // reset refs so next item starts clean
    ignorePressRef.current = false;
    pressStartRef.current = null;
    lastReleaseRef.current = null;

    if (willExhaustHearts) {
      // Hold the red state briefly, then end with a summary
      const delay = 650;
      setTimeout(() => {
        const correct = results.filter(Boolean).length; // last was wrong
        const percent = Math.round((correct / TOTAL_QUESTIONS) * 100);
        setEarlySummary({ correct, percent }); // summary UI uses earlySummary
        if (group && lessonId) {
          setScore(group, getStoreIdForProgress(String(lessonId)), "send", percent);
        }
      }, delay);
      return; // do NOT queue normal advance/reset
    }

    // Normal advance
    advanceTimerRef.current = setTimeout(() => {
      setResult(isCorrect);
      updateInput("");
      setPresses([]);
      setShowReveal(false);
      setFeedback("idle");
      advanceTimerRef.current = null;
    }, 650);
  }, [meta.isChallenge, hearts, results, group, lessonId, setScore, setResult, updateInput]);

  // -----------------------------
  // 9) KEYER HANDLERS
  // -----------------------------
  const canInteractBase =
    started && !summary && !earlySummary && !!currentTarget && feedback === "idle";

  const onPressIn = React.useCallback(() => {
    if (!canInteractBase) return;
    const now = Date.now();

    if (inputRef.current.length > 0 && lastReleaseRef.current !== null) {
      const gapDuration = now - lastReleaseRef.current;
      const gapType = classifyGapDuration(gapDuration, unitMs, gapTolerance);
      if (gapType !== "intra") {
        ignorePressRef.current = true;
        lastReleaseRef.current = null;
        finishQuestion(false);
        return;
      }
    }

    ignorePressRef.current = false;
    pressStartRef.current = now;
    onDown();
  }, [canInteractBase, unitMs, gapTolerance, finishQuestion, onDown]);

  const appendSymbol = React.useCallback((symbol: "." | "-") => {
    if (!currentTarget) return;
    const target = currentMorseRef.current;
    const next = `${inputRef.current}${symbol}`;
    updateInput(next);

    if (!target.startsWith(next)) {
      finishQuestion(false);
      return;
    }
    if (target === next) {
      finishQuestion(true);
    }
  }, [currentTarget, finishQuestion, updateInput]);

  const onPressOut = React.useCallback(() => {
    onUp();

    if (!canInteractBase) {
      ignorePressRef.current = false;
      pressStartRef.current = null;
      return;
    }

    if (ignorePressRef.current) {
      ignorePressRef.current = false;
      pressStartRef.current = null;
      return;
    }

    const startAt = pressStartRef.current;
    pressStartRef.current = null;
    if (!startAt) return;

    const releaseAt = Date.now();
    const duration = releaseAt - startAt;

    setPresses((prev) => [...prev, { startMs: startAt, endMs: releaseAt }]);

    const symbol = classifySignalDuration(duration, unitMs, signalTolerance);
    if (!symbol) {
      lastReleaseRef.current = null;
      finishQuestion(false);
      return;
    }

    lastReleaseRef.current = releaseAt;
    appendSymbol(symbol);
  }, [canInteractBase, unitMs, signalTolerance, finishQuestion, appendSymbol, onUp]);

  // -----------------------------
  // 10) RENDER
  // -----------------------------
  const handleCloseCleanup = React.useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  // Disable/enable PromptCard actions (reveal/replay)
  const revealEnabled = !meta.isChallenge;  // enabled for lessons & reviews
  const replayEnabled = !meta.isChallenge;  // Send has no audio replay; keep disabled on challenge

  const compareMode = showReveal || feedback === "correct" ? "compare" : "guessing";
  const bottomBarColor = feedback === "wrong" ? "#FF6B6B" : colors.gold;

  if (!meta.pool.length) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Content unavailable.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const finalSummary = earlySummary || summary || null;

  if (finalSummary) {
    return (
      <SafeAreaView style={styles.safe}>
        <SessionHeader
          labelTop={meta.headerTop}   // "Review" | "Challenge" | "Lesson N - ..."
          labelBottom="SEND"
          mode={meta.isChallenge ? 'challenge' : isReview ? 'review' : 'normal'}
          hearts={meta.isChallenge ? hearts : undefined}
        />
        <SessionSummary
          percent={finalSummary.percent}
          correct={finalSummary.correct}
          total={TOTAL_QUESTIONS}
          onContinue={handleCloseCleanup}
        />
      </SafeAreaView>
    );
  }

  const canInteract = canInteractBase;

  return (
    <SafeAreaView style={styles.safe}>
      <FlashOverlay opacity={flashOpacity} color={colors.text} maxOpacity={0.28} />

      <View style={styles.container}>
        {/* TOP: header + progress */}
        <View style={styles.topGroup}>
          <SessionHeader
            labelTop={meta.headerTop}
            labelBottom="SEND"
            mode={meta.isChallenge ? 'challenge' : isReview ? 'review' : 'normal'}
            hearts={meta.isChallenge ? hearts : undefined}
          />

          <ProgressBar value={results.length} total={TOTAL_QUESTIONS} streak={streak} />
        </View>

        {/* CENTER */}
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
            // Gating for actions:
            onRevealToggle={() => {
              if (!revealEnabled) return; // disabled in challenges
              setShowReveal((prev) => !prev);
            }}
            onReplay={() => {
              // Send has keyer-driven output; do nothing.
            }}
            mainSlotMinHeight={promptSlotHeight}
            belowReveal={
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

        {/* BOTTOM */}
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
// STYLES
// -----------------------------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },

  container: {
    flex: 1,
    paddingHorizontal: spacing(3),
    paddingTop: spacing(2),
    paddingBottom: spacing(2),
  },

  topGroup: { marginBottom: spacing(0.5) },

  centerGroup: { flex: 1, alignItems: "center", justifyContent: "center" },

  bottomGroup: { marginTop: spacing(0.5), alignItems: "stretch" },

  togglesWrap: {
    alignSelf: "stretch",
    minHeight: 64,
    justifyContent: "center",
    marginBottom: spacing(2),
  },

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


