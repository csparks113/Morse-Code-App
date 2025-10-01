// app/lessons/[group]/[lessonId]/send.tsx
/**
 * SEND SESSION SCREEN (Pinned layout)
 * -----------------------------------
 * Visual + layout mirrors RECEIVE:
 * - Top:    SessionHeader + ProgressBar
 * - Center: PromptCard
 * - Bottom: OutputTogglesRow above Keyer button
 *
 * Jitter/first-frame fixes applied:
 * - SafeAreaView with a matching background color
 * - Manual safe-area insets via useSafeAreaInsets()
 */

import React from "react";
import { Animated, Dimensions, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";

// Shared UI
import SessionHeader from "../../../../components/session/SessionHeader";
import ProgressBar from "../../../../components/session/ProgressBar";
import SessionSummary from "../../../../components/session/SessionSummary";
import PromptCard from "../../../../components/session/PromptCard";
import type { ActionButtonState } from "../../../../components/session/ActionButton";
import OutputTogglesRow from "../../../../components/session/OutputTogglesRow";
import KeyerButton from "../../../../components/session/KeyerButton";
import FlashOverlay from "../../../../components/session/FlashOverlay";
import MorseCompare from "../../../../components/session/MorseCompare";
import { sessionStyleSheet, sessionContainerPadding } from "../../../../theme/sessionStyles";

import { colors, spacing, status } from "../../../../theme/lessonTheme";
import { toMorse } from "../../../../utils/morse";
import { playMorseCode, stopPlayback } from "../../../../utils/audio";
import { classifyGapDuration, classifySignalDuration, getMorseUnitMs, MORSE_UNITS } from "../../../../utils/morseTiming";

// State/hooks
import { useProgressStore } from "../../../../store/useProgressStore";
import { useSettingsStore } from "../../../../store/useSettingsStore";
import { useKeyerOutputs } from "../../../../hooks/useKeyerOutputs";
import { useSessionFlow } from "../../../../hooks/useSessionFlow";

// Meta
import { buildSessionMeta } from "../../../../session/sessionMeta";

const TOTAL_QUESTIONS = 5;

type FeedbackState = "idle" | "correct" | "wrong";
type PressWindow = { startMs: number; endMs: number };

const nowMs = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

function getStoreIdForProgress(rawId: string) {
  return String(rawId);
}

export default function SendSessionScreen() {
  const insets = useSafeAreaInsets();

  const { group, lessonId } = useLocalSearchParams<{ group: string; lessonId: string }>();
  const { t } = useTranslation(["session", "common"]);
  const meta = React.useMemo(() => buildSessionMeta(group || "alphabet", lessonId), [group, lessonId]);
  const isReview = React.useMemo(() => /^\d+-review$/.test(String(lessonId)), [lessonId]);
  const setScore = useProgressStore((s) => s.setScore);
  const audioEnabled = useSettingsStore((s) => s.audioEnabled);
  const hapticsEnabled = useSettingsStore((s) => s.hapticsEnabled);
  const lightEnabled = useSettingsStore((s) => s.lightEnabled);
  const torchEnabled = useSettingsStore((s) => s.torchEnabled);
  const setAudioEnabled = useSettingsStore((s) => s.setAudioEnabled);
  const setHapticsEnabled = useSettingsStore((s) => s.setHapticsEnabled);
  const setLightEnabled = useSettingsStore((s) => s.setLightEnabled);
  const setTorchEnabled = useSettingsStore((s) => s.setTorchEnabled);
  const toneHzSetting = useSettingsStore((s) => s.toneHz as unknown as string | number);
  const signalTolerancePercent = useSettingsStore((s) => s.signalTolerancePercent ?? 30);
  const gapTolerancePercent = useSettingsStore((s) => s.gapTolerancePercent ?? 50);



  const signalTolerance = Math.min(0.45, signalTolerancePercent / 100);
  const gapTolerance = Math.min(0.7, gapTolerancePercent / 100);

  const toneHzValue = React.useMemo(() => {
    const parsed = Number(toneHzSetting);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 600;
  }, [toneHzSetting]);

  const {
    started,
    summary,
    start,
    results,
    streak,
    currentTarget,
    setResult,
  } = useSessionFlow({
    pool: meta.pool,
    total: TOTAL_QUESTIONS,
    onFinished: ({ percent }) => {
      if (group && lessonId) {
        setScore(group, getStoreIdForProgress(String(lessonId)), "send", percent);
      }
    },
  });

  const { onDown, onUp, flashOpacity, prepare, teardown } = useKeyerOutputs({
    audioEnabled,
    hapticsEnabled,
    lightEnabled,
    torchEnabled,
    toneHz: toneHzValue,
  });

  const [feedback, setFeedback] = React.useState<FeedbackState>("idle");
  const [showReveal, setShowReveal] = React.useState(false);
  const [revealUsed, setRevealUsed] = React.useState(false);
  const [, setInput] = React.useState("");
  const [presses, setPresses] = React.useState<PressWindow[]>([]);
  const [hearts, setHearts] = React.useState(3);
  const [earlySummary, setEarlySummary] = React.useState<null | { percent: number; correct: number }>(null);
  const [isReplaying, setIsReplaying] = React.useState(false);

  const inputRef = React.useRef("");
  const currentMorseRef = React.useRef("");
  const pressStartRef = React.useRef<number | null>(null);
  const lastReleaseRef = React.useRef<number | null>(null);
  const ignorePressRef = React.useRef(false);
  const advanceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const canInteractRef = React.useRef(false);

  const updateInput = React.useCallback((next: string) => {
    inputRef.current = next;
    setInput(next);
  }, []);

  const clearIdleTimeout = React.useCallback(() => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  }, []);

  const clearPlaybackTimeout = React.useCallback(() => {
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    prepare().catch(() => {});
    return () => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
      clearIdleTimeout();
      clearPlaybackTimeout();
      teardown().catch(() => {});
      stopPlayback();
    };
  }, [prepare, teardown, clearIdleTimeout, clearPlaybackTimeout]);

  const flashSymbol = React.useCallback(
    (durationMs: number) => {
      if (!lightEnabled) return;
      flashOpacity.stopAnimation?.(() => {});
      flashOpacity.setValue(1);
      clearPlaybackTimeout();
      const fadeDelay = Math.max(0, durationMs);
      playbackTimeoutRef.current = setTimeout(() => {
        Animated.timing(flashOpacity, {
          toValue: 0,
          duration: Math.min(120, Math.max(45, durationMs * 0.6)),
          useNativeDriver: true,
        }).start();
        playbackTimeoutRef.current = null;
      }, fadeDelay);
    },
    [lightEnabled, flashOpacity, clearPlaybackTimeout],
  );

  const hapticSymbol = React.useCallback(
    (symbol: "." | "-") => {
      if (!hapticsEnabled) return;
      const style = symbol === "-" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
      Haptics.impactAsync(style).catch(() => {});
    },
    [hapticsEnabled],
  );

  // -----------------------------
  // 6) LAYOUT METRICS
  // -----------------------------
  const screenH = Dimensions.get("window").height;
  const layout = screenH < 635 ? "xsmall" : screenH < 700 ? "small" : "regular";
  const promptSlotHeight = layout === "regular" ? 116 : layout === "small" ? 96 : 84;
  const keyerMinHeight = layout === "regular" ? 128 : layout === "small" ? 104 : 92;

  const currentMorse = currentTarget ? toMorse(currentTarget) ?? "" : "";
  currentMorseRef.current = currentMorse;

  const unitMs = getMorseUnitMs();
  const wpm = unitMs > 0 ? 1200 / unitMs : 12;

  const startSession = React.useCallback(() => {
    if (!meta.pool.length) return;
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }

    clearIdleTimeout();
    clearPlaybackTimeout();
    stopPlayback();
    setIsReplaying(false);

    start();
    updateInput("");
    setPresses([]);
    setShowReveal(false);
    setRevealUsed(false);
    setFeedback("idle");

    pressStartRef.current = null;
    lastReleaseRef.current = null;
    ignorePressRef.current = false;

    if (meta.isChallenge) setHearts(3);
    setEarlySummary(null);
  }, [meta.pool, meta.isChallenge, start, updateInput, clearIdleTimeout, clearPlaybackTimeout]);

  const finishQuestion = React.useCallback(
    (isCorrect: boolean) => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
      clearIdleTimeout();
      clearPlaybackTimeout();
      setIsReplaying(false);

      const willExhaustHearts = meta.isChallenge && !isCorrect && hearts <= 1;

      setFeedback(isCorrect ? "correct" : "wrong");
      if (isCorrect) setShowReveal(true);

      if (!isCorrect && meta.isChallenge) {
        setHearts((h) => Math.max(0, h - 1));
      }

      ignorePressRef.current = false;
      pressStartRef.current = null;
      lastReleaseRef.current = null;

      if (willExhaustHearts) {
        setTimeout(() => {
          const correctCount = results.filter(Boolean).length;
          const percent = Math.round((correctCount / TOTAL_QUESTIONS) * 100);
          setEarlySummary({ correct: correctCount, percent });
          if (group && lessonId) {
            setScore(group, getStoreIdForProgress(String(lessonId)), "send", percent);
          }
        }, 650);
        return;
      }

      advanceTimerRef.current = setTimeout(() => {
        setResult(isCorrect);
        updateInput("");
        setPresses([]);
        setShowReveal(false);
        setRevealUsed(false);
        setFeedback("idle");
        advanceTimerRef.current = null;
      }, 650);
    },
    [meta.isChallenge, hearts, results, group, lessonId, setScore, setResult, updateInput, clearIdleTimeout, clearPlaybackTimeout],
  );

  const scheduleIdleTimeout = React.useCallback(() => {
    clearIdleTimeout();
    if (!canInteractRef.current) return;
    const timeoutMs = Math.max(600, unitMs * MORSE_UNITS.word * 1.2);
    idleTimeoutRef.current = setTimeout(() => {
      if (!canInteractRef.current) return;
      finishQuestion(false);
    }, timeoutMs);
  }, [clearIdleTimeout, unitMs, finishQuestion]);

  const canInteractBase =
    started && !summary && !earlySummary && !!currentTarget && feedback === "idle";

  React.useEffect(() => {
    canInteractRef.current = canInteractBase;
  }, [canInteractBase]);

  const onPressIn = React.useCallback(() => {
    if (!canInteractBase || isReplaying) return;
    clearIdleTimeout();

    const timestamp = nowMs();

    if (inputRef.current.length > 0 && lastReleaseRef.current !== null) {
      const gapDuration = timestamp - lastReleaseRef.current;
      const gapType = classifyGapDuration(gapDuration, unitMs, gapTolerance);
      if (gapType !== "intra") {
        ignorePressRef.current = true;
        lastReleaseRef.current = null;
        finishQuestion(false);
        return;
      }
    }

    ignorePressRef.current = false;
    pressStartRef.current = timestamp;
    onDown();
  }, [canInteractBase, isReplaying, unitMs, gapTolerance, finishQuestion, onDown, clearIdleTimeout]);

  const appendSymbol = React.useCallback(
    (symbol: "." | "-") => {
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
        return;
      }

      scheduleIdleTimeout();
    },
    [currentTarget, finishQuestion, updateInput, scheduleIdleTimeout],
  );

  const onPressOut = React.useCallback(() => {
    onUp();

    if (!canInteractBase || isReplaying) {
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

    const releaseAt = nowMs();
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
  }, [canInteractBase, isReplaying, unitMs, signalTolerance, finishQuestion, appendSymbol, onUp]);

  const handleCloseCleanup = React.useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    clearIdleTimeout();
    clearPlaybackTimeout();
    stopPlayback();
  }, [clearIdleTimeout, clearPlaybackTimeout]);

  const playCurrentTarget = React.useCallback(async () => {
    if (isReplaying) return;
    const morse = currentMorseRef.current;
    if (!morse) return;

    setIsReplaying(true);
    clearIdleTimeout();
    try {
      await playMorseCode(morse, unitMs, {
        onSymbolStart: (symbol, durationMs) => {
          hapticSymbol(symbol);
          flashSymbol(durationMs);
        },
      });
    } catch (error) {
      console.warn("send replay failed", error);
    } finally {
      clearPlaybackTimeout();
      flashOpacity.stopAnimation?.(() => {});
      flashOpacity.setValue(0);
      setIsReplaying(false);
    }
  }, [isReplaying, unitMs, hapticSymbol, flashSymbol, clearIdleTimeout, clearPlaybackTimeout, flashOpacity]);

  const handleRevealToggle = React.useCallback(() => {
    if (meta.isChallenge || !started || !currentTarget || summary || earlySummary) return;
    if (showReveal || feedback !== "idle" || isReplaying) return;
    setShowReveal(true);
    setRevealUsed(true);
    clearIdleTimeout();
  }, [meta.isChallenge, started, currentTarget, summary, earlySummary, showReveal, feedback, isReplaying, clearIdleTimeout]);

  const handleReplayPress = React.useCallback(() => {
    if (isReplaying) return;
    playCurrentTarget().catch(() => {});
  }, [isReplaying, playCurrentTarget]);

  const revealState: ActionButtonState = (() => {
    if (meta.isChallenge) return "disabled";
    if (!started || !currentTarget || summary || earlySummary || isReplaying) return "disabled";
    if (showReveal || revealUsed || feedback !== "idle") return "disabled";
    return "active";
  })();

  const replayState: ActionButtonState = (() => {
    if (!started || !currentTarget || summary || earlySummary) return "disabled";
    if (isReplaying) return "disabled";
    return "active";
  })();

  const revealAction = React.useMemo(
    () => ({
      icon: "eye-outline" as const,
      accessibilityLabel: t("session:reveal"),
      onPress: handleRevealToggle,
      state: revealState,
    }),
    [handleRevealToggle, revealState, t],
  );

  const replayAction = React.useMemo(
    () => ({
      icon: "play" as const,
      accessibilityLabel: t("session:replay"),
      onPress: handleReplayPress,
      state: replayState,
    }),
    [handleReplayPress, replayState, t],
  );

  const compareMode = showReveal || feedback === "correct" ? "compare" : "guessing";
  const bottomBarColor = feedback === "wrong" ? status.error : colors.gold;

  const finalSummary = earlySummary || summary || null;

  if (!meta.pool.length) {
    return (
      <SafeAreaView style={sessionStyleSheet.safe} edges={[]}>
        <View style={[sessionStyleSheet.container, sessionContainerPadding(insets)]}>
          <View style={sessionStyleSheet.emptyState}>
            <Text style={sessionStyleSheet.emptyText}>{t("session:contentUnavailable")}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (finalSummary) {
    return (
      <SafeAreaView style={sessionStyleSheet.safe} edges={[]}>
        <View style={[sessionStyleSheet.container, sessionContainerPadding(insets)]}>
          <SessionHeader
            labelTop={meta.headerTop}
            labelBottom={t("session:sendMode")}
            mode={meta.isChallenge ? "challenge" : isReview ? "review" : "normal"}
            hearts={meta.isChallenge ? hearts : undefined}
          />
          <SessionSummary
            percent={finalSummary.percent}
            correct={finalSummary.correct}
            total={TOTAL_QUESTIONS}
            onContinue={handleCloseCleanup}
          />
        </View>
      </SafeAreaView>
    );
  }

  const canInteract = canInteractBase && !isReplaying;

  return (
    <SafeAreaView style={sessionStyleSheet.safe} edges={[]}>
      <FlashOverlay opacity={flashOpacity} color={colors.text} maxOpacity={0.28} />

      <View
        style={[
          sessionStyleSheet.container,
          {
            paddingTop: insets.top + spacing(2),
            paddingBottom: insets.bottom + spacing(2),
          },
        ]}
      >
        <View style={sessionStyleSheet.topGroup}>
          <SessionHeader
            labelTop={meta.headerTop}
            labelBottom={t("session:sendMode")}
            mode={meta.isChallenge ? "challenge" : isReview ? "review" : "normal"}
            hearts={meta.isChallenge ? hearts : undefined}
          />
          <ProgressBar value={results.length} total={TOTAL_QUESTIONS} streak={streak} />
        </View>

        <View style={sessionStyleSheet.centerGroup}>
          <PromptCard
            compact
            revealSize="sm"
            title={t("session:tapToKey")}
            started={!!started}
            visibleChar={started ? currentTarget ?? "" : ""}
            feedback={feedback}
            morse=""
            showReveal={showReveal}
            canInteract={canInteract}
            onStart={startSession}
            revealAction={revealAction}
            replayAction={replayAction}
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

        <View style={sessionStyleSheet.bottomGroup}>
          <View style={sessionStyleSheet.togglesWrap}>
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

          <View style={sessionStyleSheet.inputZone}>
            <KeyerButton
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              disabled={!canInteract}
              minHeight={keyerMinHeight}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}


















