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
import KeyerButton from '../../../../components/session/KeyerButton';
import FlashOverlay from '../../../../components/session/FlashOverlay';
import MorseCompare from '../../../../components/session/MorseCompare';
import { sessionStyleSheet, sessionContainerPadding } from '../../../../theme/sessionStyles';

import { colors, spacing, status } from '../../../../theme/lessonTheme';

// Stores & hooks
import { useSettingsStore } from '../../../../store/useSettingsStore';
import { buildSessionMeta } from '../../../../session/sessionMeta';
import { useSendSession, TOTAL_SEND_QUESTIONS } from '../../../../hooks/useSendSession';

export default function SendSessionScreen() {
  const insets = useSafeAreaInsets();
  const { group, lessonId } = useLocalSearchParams<{ group: string; lessonId: string }>();
  const { t } = useTranslation(['session', 'common']);
  const meta = React.useMemo(() => buildSessionMeta(group || 'alphabet', lessonId), [group, lessonId]);
  const isReview = React.useMemo(() => /^\d+-review$/.test(String(lessonId)), [lessonId]);

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

  const toneHzValue = React.useMemo(() => {
    const parsed = Number(toneHzSetting);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 600;
  }, [toneHzSetting]);

  const {
    started,
    currentTarget,
    visibleChar,
    compareMode,
    revealAction,
    replayAction,
    feedback,
    showReveal,
    hearts,
    streak,
    progressValue,
    promptSlotHeight,
    keyerMinHeight,
    wpm,
    presses,
    flashOpacity,
    finalSummary,
    canInteract,
    startSession,
    onPressIn,
    onPressOut,
    handleSummaryContinue,
  } = useSendSession({
    pool: meta.pool,
    isChallenge: meta.isChallenge,
    groupId: typeof group === 'string' ? group : undefined,
    lessonId: lessonId ? String(lessonId) : undefined,
    audioEnabled,
    hapticsEnabled,
    lightEnabled,
    torchEnabled,
    toneHz: toneHzValue,
    signalTolerancePercent,
    gapTolerancePercent,
    actionLabels: {
      reveal: t('session:reveal'),
      replay: t('session:replay'),
    },
  });

  const bottomBarColor = feedback === 'wrong' ? status.error : colors.gold;

  if (!meta.pool.length) {
    return (
      <SafeAreaView style={sessionStyleSheet.safe} edges={[]}>
        <View style={[sessionStyleSheet.container, sessionContainerPadding(insets)]}>
          <View style={sessionStyleSheet.emptyState}>
            <Text style={sessionStyleSheet.emptyText}>{t('session:contentUnavailable')}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (finalSummary) {
    return (
      <SafeAreaView style={sessionStyleSheet.safe} edges={[]}>
        <View
          style={[
            sessionStyleSheet.container,
            sessionContainerPadding(insets, spacing(2), spacing(4)),
          ]}
        >
          <View style={sessionStyleSheet.topGroup}>
            <SessionHeader
              labelTop={meta.headerTop}
              labelBottom={t('session:sendMode')}
              mode={meta.isChallenge ? 'challenge' : isReview ? 'review' : 'normal'}
              hearts={meta.isChallenge ? hearts : undefined}
            />
          </View>

          <View style={sessionStyleSheet.centerGroup}>
            <SessionSummaryContent
              percent={finalSummary.percent}
              correct={finalSummary.correct}
              total={TOTAL_SEND_QUESTIONS}
            />
          </View>

          <View style={[sessionStyleSheet.bottomGroup, { alignItems: 'center' }]}>
            <SessionSummaryContinue onContinue={handleSummaryContinue} />
          </View>
        </View>
      </SafeAreaView>
    );
  }


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
            labelBottom={t('session:sendMode')}
            mode={meta.isChallenge ? 'challenge' : isReview ? 'review' : 'normal'}
            hearts={meta.isChallenge ? hearts : undefined}
          />

          <ProgressBar value={progressValue} total={TOTAL_SEND_QUESTIONS} streak={streak} />
        </View>

        <View style={sessionStyleSheet.centerGroup}>
          <PromptCard
            compact
            revealSize="sm"
            title={t('session:tapToKey')}
            started={started}
            visibleChar={visibleChar}
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






















