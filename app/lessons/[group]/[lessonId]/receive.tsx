// app/lessons/[group]/[lessonId]/receive.tsx

/**
 * RECEIVE SESSION SCREEN (Pinned layout)
 * --------------------------------------
 * Top:    SessionHeader + ProgressBar
 * Center: PromptCard (timeline compare under reveal)
 * Bottom: OutputTogglesRow + Input (LessonChoices OR ChallengeKeyboard)
 */

import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

// Shared UI
import SessionHeader from '../../../../components/session/SessionHeader';
import ProgressBar from '../../../../components/session/ProgressBar';
import { SessionSummaryContent, SessionSummaryContinue } from '../../../../components/session/SessionSummary';
import PromptCard from '../../../../components/session/PromptCard';
import OutputTogglesRow from '../../../../components/session/OutputTogglesRow';
import TorchDiagnosticsNotice from '../../../../components/session/TorchDiagnosticsNotice';
import FlashOverlay from '../../../../components/session/FlashOverlay';
import LessonChoices from '../../../../components/session/LessonChoices';
import MorseCompare from '../../../../components/session/MorseCompare';
import ChallengeKeyboard from '../../../../components/session/ChallengeKeyboard';
import { sessionStyleSheet, sessionContainerPadding } from '../../../../theme/sessionStyles';

// Theme + utils
import { colors, sessionLayoutTheme } from '../../../../theme/lessonTheme';
// Stores & hooks
import { useSettingsStore } from '../../../../store/useSettingsStore';
import { buildSessionMeta } from '../../../../session/sessionMeta';
import { useReceiveSession, TOTAL_RECEIVE_QUESTIONS } from '../../../../hooks/useReceiveSession';

export default function ReceiveSessionScreen() {
  const insets = useSafeAreaInsets();
  const { group, lessonId } = useLocalSearchParams<{ group: string; lessonId: string }>();

  const { t } = useTranslation(['session', 'common']);
  const meta = React.useMemo(
    () => buildSessionMeta(group || 'alphabet', lessonId),
    [group, lessonId],
  );

  const isReview = React.useMemo(
    () => /^\d+-review$/.test(String(lessonId)),
    [lessonId],
  );

  const {
    audioEnabled,
    lightEnabled,
    torchEnabled,
    hapticsEnabled,
    setAudioEnabled,
    setLightEnabled,
    setTorchEnabled,
    setHapticsEnabled,
  } = useSettingsStore();

  const flashBrightnessPercent = useSettingsStore((s) => s.flashBrightnessPercent ?? 80);
  const flashOffsetMs = useSettingsStore((s) => s.flashOffsetMs ?? 0);
  const hapticOffsetMs = useSettingsStore((s) => s.hapticOffsetMs ?? 0);

  const flashMaxOpacity = React.useMemo(() => {
    return 0.28 * Math.max(0, Math.min(1, flashBrightnessPercent / 100));
  }, [flashBrightnessPercent]);

  const {
    started,
    summary,
    feedback,
    showReveal,
    revealAction,
    replayAction,
    visibleChar,
    hearts,
    streak,
    progressValue,
    canInteract,
    currentTarget,
    wpm,
    promptSlotHeight,
    flashOpacity,
    startSession,
    submitAnswer,
    handleSummaryContinue,
  } = useReceiveSession({
    pool: meta.pool,
    isChallenge: meta.isChallenge,
    groupId: typeof group === 'string' ? group : undefined,
    lessonId: lessonId ? String(lessonId) : undefined,
    lightEnabled,
    hapticsEnabled,
    flashBrightnessPercent,
    flashOffsetMs,
    hapticOffsetMs,
    actionLabels: {
      reveal: t('session:reveal'),
      replay: t('session:replay'),
    },
  });

  const learnedSet = React.useMemo(
    () => new Set(meta.pool.map((c) => c.toUpperCase())),
    [meta.pool],
  );

  // Empty state when session has no glyphs available
  if (!meta.pool.length) {
    return (
      <SafeAreaView style={sessionStyleSheet.safe} edges={[]}>
        <View style={[sessionStyleSheet.container, sessionContainerPadding(insets, { topStep: sessionLayoutTheme.footer.topPaddingStep, footerVariant: 'summary' })]}>
          <View style={sessionStyleSheet.emptyState}>
            <Text style={sessionStyleSheet.emptyText}>{t('session:contentUnavailable')}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Results summary state
  if (summary) {
    return (
      <SafeAreaView style={sessionStyleSheet.safe} edges={[]}>
        <View
          style={[
            sessionStyleSheet.container,
            sessionContainerPadding(insets, { topStep: sessionLayoutTheme.footer.topPaddingStep, footerVariant: 'summary' }),
          ]}
        >
          <View style={sessionStyleSheet.topGroup}>
            <SessionHeader
              labelTop={meta.headerTop}
              labelBottom={t('session:receiveMode')}
              mode={meta.isChallenge ? 'challenge' : isReview ? 'review' : 'normal'}
              hearts={meta.isChallenge ? hearts : undefined}
            />
          </View>

          <View style={sessionStyleSheet.centerGroup}>
            <SessionSummaryContent
              percent={summary.percent}
              correct={summary.correct}
              total={TOTAL_RECEIVE_QUESTIONS}
            />
          </View>

          <View style={[sessionStyleSheet.bottomGroup, { alignItems: 'center' }]}>
            <SessionSummaryContinue onContinue={handleSummaryContinue} onRetry={startSession} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={sessionStyleSheet.safe} edges={[]}>
      {/* Flash overlay for playback */}
        <FlashOverlay opacity={flashOpacity} color={colors.text} maxOpacity={flashMaxOpacity} />
      <View style={[sessionStyleSheet.container, sessionContainerPadding(insets, { topStep: sessionLayoutTheme.footer.topPaddingStep, footerVariant: 'summary' })]}>
        {/* --- TOP (fixed): header + progress --- */}
        <View style={sessionStyleSheet.topGroup}>
          <SessionHeader
            labelTop={meta.headerTop}
            labelBottom={t('session:receiveMode')}
            mode={meta.isChallenge ? 'challenge' : isReview ? 'review' : 'normal'}
            hearts={meta.isChallenge ? hearts : undefined}
          />

          <ProgressBar value={progressValue} total={TOTAL_RECEIVE_QUESTIONS} streak={streak} />
        </View>

        {/* --- CENTER (flex, centered): PromptCard only --- */}
        <View style={sessionStyleSheet.centerGroup}>
          <PromptCard
            compact
            revealSize="sm"
            title={t('session:identifyCharacter')}
            started={started}
            visibleChar={visibleChar}
            feedback={feedback}
            morse=""
            showReveal={showReveal}
            onStart={startSession}
            revealAction={revealAction}
            replayAction={replayAction}
            mainSlotMinHeight={promptSlotHeight}
            belowReveal={
              (showReveal || feedback !== 'idle') && currentTarget ? (
                <MorseCompare
                  mode="compare"
                  char={currentTarget}
                  presses={[]}
                  wpm={wpm}
                  size="md"
                  topColor={colors.blueNeon}
                  bottomColor={colors.gold}
                  align="center"
                />
              ) : null
            }
          />
        </View>

        {/* --- BOTTOM (fixed): toggles above input --- */}
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
            <TorchDiagnosticsNotice />
          </View>

          <View style={sessionStyleSheet.inputZone}>
            {meta.isChallenge || isReview ? (
              <ChallengeKeyboard
                learnedSet={learnedSet}
                canInteract={canInteract}
                onKeyPress={submitAnswer}
              />
            ) : (
              <LessonChoices
                choices={meta.pool}
                disabled={!canInteract}
                onChoose={submitAnswer}
                style={sessionStyleSheet.lessonChoices}
              />
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}






