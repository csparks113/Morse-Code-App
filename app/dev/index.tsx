import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Pressable,
  FlatList,
  ListRenderItem,
  TextInput,
  Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { sessionStyleSheet, sessionContainerPadding } from '@/theme/sessionStyles';
import SessionHeader from '@/components/session/SessionHeader';
import { colors as lessonColors, spacing, surfaces } from '@/theme/lessonTheme';
import { theme } from '@/theme/theme';
import {
  useDeveloperStore,
  outputsTraceBufferSize,
  type OutputsTraceEntry,
} from '@/store/useDeveloperStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useOutputsService, type KeyerOutputsOptions } from '@/services/outputs/OutputsService';
import { useOutputsDiagnosticsStore } from '@/store/useOutputsDiagnosticsStore';
import {
  useLatencyStats,
  resetLatencyMetrics,
  type LatencyChannel,
} from '@/store/useOutputsLatencyStore';
import FlashOverlay from '@/components/session/FlashOverlay';

const TIMESTAMP_DECIMALS = 1;
const EXPORT_LIMIT = 200;
const DEFAULT_PATTERN = '... --- ...';
type FilterKey = 'all' | 'keyer' | 'replay' | 'torch';

const FILTER_OPTIONS: Array<{
  key: FilterKey;
  label: string;
  predicate: (event: string) => boolean;
}> = [
  { key: 'all', label: 'All', predicate: () => true },
  { key: 'keyer', label: 'Keyer', predicate: (event) => event.startsWith('keyer.') },
  { key: 'replay', label: 'Replay', predicate: (event) => event.startsWith('playMorse.') },
  { key: 'torch', label: 'Torch', predicate: (event) => event.includes('torch') },
];

const QUICK_FILTERS: Array<{ id: string; label: string; filterKey?: FilterKey; search?: string }> = [
  { id: 'pulses', label: 'Pulses', search: 'outputs.' },
  { id: 'replays', label: 'Replays', filterKey: 'replay' },
  { id: 'keyer', label: 'Keyer', filterKey: 'keyer' },
];

const LATENCY_CHANNELS: Array<{ channel: LatencyChannel; label: string }> = [
  { channel: 'touchToTone', label: 'Tone' },
  { channel: 'touchToHaptic', label: 'Haptic' },
  { channel: 'touchToFlash', label: 'Flash' },
  { channel: 'touchToTorch', label: 'Torch' },
];

function formatLatency(value: number | null) {
  if (value == null) {
    return 'n/a';
  }
  return `${value} ms`;
}

const devConsoleTheme = {
  panel: surfaces.slate,
  subtle: surfaces.sunken,
  chip: surfaces.muted,
  switchThumb: surfaces.slate,
};

function formatMonotonicTimestamp(value: number) {
  return `${value.toFixed(TIMESTAMP_DECIMALS)} ms`;
}

function formatWallClock(value: number) {
  const date = new Date(value);
  const time = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const milli = date.getMilliseconds().toString().padStart(3, '0');
  return `${time}.${milli}`;
}

function sanitizePatternInput(value: string) {
  return value.replace(/[^.\-\s]/g, '').replace(/\s{2,}/g, ' ');
}

function wpmToUnitMs(wpm: number) {
  if (!Number.isFinite(wpm) || wpm <= 0) {
    return 120;
  }
  return Math.max(1, Math.round(1200 / wpm));
}

const renderTraceItem: ListRenderItem<OutputsTraceEntry> = ({ item }) => {
  return (
    <View style={styles.logItem}>
      <View style={styles.logHeader}>
        <Text style={styles.logLabel}>{item.event}</Text>
        <View style={styles.logTimestamps}>
          <Text style={styles.logTimestamp}>{formatWallClock(item.wallClock)}</Text>
          <Text style={styles.logTimestampMonotonic}>
            {formatMonotonicTimestamp(item.timestamp)}
          </Text>
        </View>
      </View>
      {item.payload ? (
        <Text style={styles.logPayload}>{JSON.stringify(item.payload, null, 2)}</Text>
      ) : null}
    </View>
  );
};

export default function DeveloperConsoleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const outputs = useOutputsService();

  const handleClose = React.useCallback(() => {
    router.back();
  }, [router]);

  const developerMode = useDeveloperStore((state) => state.developerMode);
  const outputsTracingEnabled = useDeveloperStore((state) => state.outputsTracingEnabled);
  const traces = useDeveloperStore((state) => state.traces);
  const setOutputsTracingEnabled = useDeveloperStore((state) => state.setOutputsTracingEnabled);
  const clearTraces = useDeveloperStore((state) => state.clearTraces);

  const manualOptions = useDeveloperStore((state) => state.manualTriggers);
  const setManualTriggers = useDeveloperStore((state) => state.setManualTriggers);
  const manualPattern = useDeveloperStore((state) => state.manualPattern);
  const setManualPattern = useDeveloperStore((state) => state.setManualPattern);
  const manualWpm = useDeveloperStore((state) => state.manualWpm);
  const setManualWpm = useDeveloperStore((state) => state.setManualWpm);

  const flashOffsetMs = useSettingsStore((state) => state.flashOffsetMs);
  const setFlashOffsetMs = useSettingsStore((state) => state.setFlashOffsetMs);
  const hapticOffsetMs = useSettingsStore((state) => state.hapticOffsetMs);
  const setHapticOffsetMs = useSettingsStore((state) => state.setHapticOffsetMs);

  const [patternInput, setPatternInput] = React.useState(manualPattern);
  React.useEffect(() => {
    setPatternInput(manualPattern);
  }, [manualPattern]);

  const [wpmInput, setWpmInput] = React.useState(() => manualWpm.toString());
  React.useEffect(() => {
    setWpmInput(manualWpm.toString());
  }, [manualWpm]);

  const [flashOffsetInput, setFlashOffsetInput] = React.useState(() => flashOffsetMs.toString());
  const [hapticOffsetInput, setHapticOffsetInput] = React.useState(() => hapticOffsetMs.toString());

  React.useEffect(() => {
    setFlashOffsetInput(flashOffsetMs.toString());
  }, [flashOffsetMs]);

  React.useEffect(() => {
    setHapticOffsetInput(hapticOffsetMs.toString());
  }, [hapticOffsetMs]);

  const [filterKey, setFilterKey] = React.useState<FilterKey>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [autoScroll, setAutoScroll] = React.useState(true);
  const listRef = React.useRef<FlatList<OutputsTraceEntry> | null>(null);

  const [manualFlashValue, setManualFlashValue] = React.useState(() => outputs.createFlashValue());
  const manualHandleRef = React.useRef<ReturnType<typeof outputs.createKeyerOutputs> | null>(null);
  const manualTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const torchSupported = outputs.isTorchSupported();
  const torchFailureCount = useOutputsDiagnosticsStore((state) => state.torchFailureCount);
  const torchFailureReason = useOutputsDiagnosticsStore((state) => state.lastFailureReason);

  const toneLatencyStats = useLatencyStats('touchToTone');
  const hapticLatencyStats = useLatencyStats('touchToHaptic');
  const flashLatencyStats = useLatencyStats('touchToFlash');
  const torchLatencyStats = useLatencyStats('touchToTorch');

  const latencyStatsLookup = React.useMemo<Record<LatencyChannel, ReturnType<typeof useLatencyStats>>>(
    () => ({
      touchToTone: toneLatencyStats,
      touchToHaptic: hapticLatencyStats,
      touchToFlash: flashLatencyStats,
      touchToTorch: torchLatencyStats,
    }),
    [toneLatencyStats, hapticLatencyStats, flashLatencyStats, torchLatencyStats],
  );

  const trimmedTorchFailureReason = React.useMemo(() => torchFailureReason?.trim() || null, [torchFailureReason]);

  const hasLatencySamples = React.useMemo(
    () => LATENCY_CHANNELS.some(({ channel }) => latencyStatsLookup[channel].count > 0),
    [latencyStatsLookup],
  );

  const handleResetLatency = React.useCallback(() => {
    resetLatencyMetrics();
  }, []);

  React.useEffect(() => {
    if (!developerMode) {
      router.replace('/(tabs)/settings');
    }
  }, [developerMode, router]);

  React.useEffect(() => {
    const handle = outputs.createKeyerOutputs(manualOptions);
    const previous = manualHandleRef.current;
    manualHandleRef.current = handle;
    previous?.teardown().catch(() => {});
    setManualFlashValue(outputs.createFlashValue());

    return () => {
      handle.teardown().catch(() => {});
    };
  }, [outputs]);

  React.useEffect(() => {
    manualHandleRef.current?.updateOptions(manualOptions);
  }, [manualOptions]);

  React.useEffect(() => {
    return () => {
      manualTimeoutRef.current && clearTimeout(manualTimeoutRef.current);
      manualHandleRef.current?.teardown().catch(() => {});
    };
  }, []);

  const clearManualTimeout = React.useCallback(() => {
    if (manualTimeoutRef.current) {
      clearTimeout(manualTimeoutRef.current);
      manualTimeoutRef.current = null;
    }
  }, []);

  const handlePatternChange = React.useCallback(
    (value: string) => {
      const sanitized = sanitizePatternInput(value);
      setPatternInput(sanitized);
      setManualPattern(sanitized.trim() || DEFAULT_PATTERN);
    },
    [setManualPattern],
  );

  const handleWpmChange = React.useCallback(
    (value: string) => {
      const sanitized = value.replace(/[^0-9.]/g, '');
      setWpmInput(sanitized);
      const parsed = Number(sanitized);
      if (Number.isFinite(parsed) && parsed > 0) {
        setManualWpm(parsed);
      }
    },
    [setManualWpm],
  );

  const handleManualToggle = React.useCallback(
    (key: keyof KeyerOutputsOptions) => (enabled: boolean) => {
      setManualTriggers({ [key]: enabled } as Partial<KeyerOutputsOptions>);
    },
    [setManualTriggers],
  );

  const unitMs = React.useMemo(() => wpmToUnitMs(manualWpm), [manualWpm]);

  const triggerPulse = React.useCallback(
    async (units: number) => {
      clearManualTimeout();
      const handle = manualHandleRef.current;
      if (!handle) {
        return;
      }

      try {
        await handle.prepare();
      } catch (error) {
        console.warn('Manual prepare failed', error);
      }

      const durationMs = units * unitMs;
      const startedAt = Date.now();
      handle.pressStart(startedAt);
      manualTimeoutRef.current = setTimeout(() => {
        handle.pressEnd(startedAt + durationMs);
        manualTimeoutRef.current = null;
      }, durationMs);
    },
    [clearManualTimeout, unitMs],
  );

  const triggerReplay = React.useCallback(async () => {
    clearManualTimeout();
    const pattern = (manualPattern || DEFAULT_PATTERN).replace(/\s+/g, ' ').trim() || DEFAULT_PATTERN;

    try {
      await outputs.playMorse({
        morse: pattern,
        unitMs,
        onSymbolStart: (symbol, durationMs) => {
          outputs.hapticSymbol({
            enabled: manualOptions.hapticsEnabled,
            symbol,
            durationMs,
          });
          outputs.flashPulse({
            enabled: manualOptions.lightEnabled,
            durationMs,
            flashValue: manualFlashValue,
          });
        },
      });
    } catch (error) {
      console.warn('Manual playMorse failed', error);
    }
  }, [clearManualTimeout, manualFlashValue, manualOptions.hapticsEnabled, manualOptions.lightEnabled, manualPattern, outputs, unitMs]);

  const triggerStop = React.useCallback(() => {
    clearManualTimeout();
    manualHandleRef.current?.pressEnd(Date.now());
    outputs.stopMorse();
    manualFlashValue.stopAnimation?.(() => {
      manualFlashValue.setValue(0);
    });
  }, [clearManualTimeout, manualFlashValue, outputs]);

  const orderedTraces = React.useMemo(() => [...traces].reverse(), [traces]);

  const activeFilter = React.useMemo(
    () => FILTER_OPTIONS.find((option) => option.key === filterKey) ?? FILTER_OPTIONS[0],
    [filterKey],
  );

  const searchLower = React.useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  const filteredTraces = React.useMemo(() => {
    return orderedTraces.filter((entry) => {
      if (!activeFilter.predicate(entry.event)) {
        return false;
      }
      if (!searchLower) {
        return true;
      }
      if (entry.event.toLowerCase().includes(searchLower)) {
        return true;
      }
      if (!entry.payload) {
        return false;
      }
      try {
        return JSON.stringify(entry.payload).toLowerCase().includes(searchLower);
      } catch {
        return false;
      }
    });
  }, [orderedTraces, activeFilter, searchLower]);

  React.useEffect(() => {
    if (!autoScroll || filteredTraces.length === 0) {
      return;
    }
    const timeout = setTimeout(() => {
      listRef.current?.scrollToOffset({
        offset: 0,
        animated: filteredTraces.length > 1,
      });
    }, 32);
    return () => clearTimeout(timeout);
  }, [filteredTraces, autoScroll]);

  const traceStats = React.useMemo(() => {
    let keyerCount = 0;
    let replayCount = 0;
    let flashCount = 0;
    let hapticCount = 0;
    let flashTotal = 0;
    let flashSamples = 0;
    let hapticTotal = 0;
    let hapticSamples = 0;

    orderedTraces.forEach((entry) => {
      if (entry.event.startsWith('keyer.')) keyerCount += 1;
      if (entry.event.startsWith('playMorse.')) replayCount += 1;
      if (entry.event === 'outputs.flashPulse') {
        flashCount += 1;
        const duration = Number((entry.payload as any)?.durationMs);
        if (Number.isFinite(duration)) {
          flashSamples += 1;
          flashTotal += duration;
        }
      }
      if (entry.event === 'outputs.hapticSymbol') {
        hapticCount += 1;
        const duration = Number((entry.payload as any)?.durationMs);
        if (Number.isFinite(duration)) {
          hapticSamples += 1;
          hapticTotal += duration;
        }
      }
    });

    const average = (total: number, samples: number) => (samples > 0 ? Math.round(total / samples) : null);

    return {
      total: orderedTraces.length,
      keyerCount,
      replayCount,
      flashCount,
      hapticCount,
      avgFlash: average(flashTotal, flashSamples),
      avgHaptic: average(hapticTotal, hapticSamples),
    };
  }, [orderedTraces]);

  const handleQuickFilter = React.useCallback(
    (preset: (typeof QUICK_FILTERS)[number]) => {
      setFilterKey(preset.filterKey ?? 'all');
      setSearchQuery(preset.search ?? '');
    },
    [setFilterKey, setSearchQuery],
  );

  const handleFlashOffsetChange = React.useCallback(
    (value: string) => {
      const sanitized = value.replace(/[^0-9-]/g, '');
      setFlashOffsetInput(sanitized);
      const parsed = Number(sanitized);
      if (Number.isFinite(parsed)) {
        const clamped = Math.max(-300, Math.min(300, Math.round(parsed)));
        setFlashOffsetMs(clamped);
      }
    },
    [setFlashOffsetMs],
  );

  const handleHapticOffsetChange = React.useCallback(
    (value: string) => {
      const sanitized = value.replace(/[^0-9-]/g, '');
      setHapticOffsetInput(sanitized);
      const parsed = Number(sanitized);
      if (Number.isFinite(parsed)) {
        const clamped = Math.max(-300, Math.min(300, Math.round(parsed)));
        setHapticOffsetMs(clamped);
      }
    },
    [setHapticOffsetMs],
  );

  const resetFlashOffsetInput = React.useCallback(() => {
    setFlashOffsetInput(flashOffsetMs.toString());
  }, [flashOffsetMs]);

  const resetHapticOffsetInput = React.useCallback(() => {
    setHapticOffsetInput(hapticOffsetMs.toString());
  }, [hapticOffsetMs]);

  const handleManualScroll = React.useCallback(() => {
    if (autoScroll) {
      setAutoScroll(false);
    }
  }, [autoScroll]);

  const handleExport = React.useCallback(async () => {
    if (filteredTraces.length === 0) {
      return;
    }
    const payload = JSON.stringify(filteredTraces.slice(0, EXPORT_LIMIT), null, 2);
    try {
      await Share.share({
        title: 'Outputs trace export',
        message: payload,
      });
    } catch (error) {
      console.warn('Failed to export trace buffer', error);
    }
  }, [filteredTraces]);

  const totalCount = orderedTraces.length;
  const filteredCount = filteredTraces.length;

  return (
    <SafeAreaView style={sessionStyleSheet.safe} edges={['top']}>
      <View
        style={[
          sessionStyleSheet.container,
          sessionContainerPadding(insets, { footerVariant: 'dev' }),
        ]}
      >
        <FlashOverlay opacity={manualFlashValue} color={lessonColors.text} maxOpacity={0.28} />

        <View style={sessionStyleSheet.topGroup}>
          <SessionHeader
            labelTop="Developer Mode"
            labelBottom="CONSOLE"
            exitToHome={false}
            onClose={handleClose}
          />
          <Text style={styles.subtitle}>
            Outputs tracing buffer stores the {outputsTraceBufferSize} most recent events.
          </Text>
        </View>

        <View style={[sessionStyleSheet.centerGroup, styles.traceListWrapper]}>
          <View style={styles.filterControls}>
            <View style={styles.filterChipsRow}>
              {FILTER_OPTIONS.map((option) => {
                const isActive = option.key === filterKey;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setFilterKey(option.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    style={({ pressed }) => [
                      styles.filterChip,
                      isActive && styles.filterChipActive,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isActive && styles.filterChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Filter by event or payload..."
              placeholderTextColor={lessonColors.textDim}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              cursorColor={lessonColors.text}
            />

            <View style={styles.filterSummaryRow}>
              <Text style={styles.filterSummary}>
                Showing {filteredCount} of {totalCount} events
              </Text>
            </View>

            <View style={styles.quickFiltersRow}>
              {QUICK_FILTERS.map((preset) => {
                const isActive =
                  (preset.filterKey ?? 'all') === filterKey && (preset.search ?? '') === searchQuery;
                return (
                  <Pressable
                    key={preset.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    style={({ pressed }) => [
                      styles.quickFilterChip,
                      isActive && styles.quickFilterChipActive,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => handleQuickFilter(preset)}
                  >
                    <Text
                      style={[
                        styles.quickFilterChipText,
                        isActive && styles.quickFilterChipTextActive,
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statsChip}>
                <Text style={styles.statsChipLabel}>Flash</Text>
                <Text style={styles.statsChipValue}>
                  {traceStats.flashCount}
                  {traceStats.avgFlash != null ? ` (${traceStats.avgFlash}ms avg)` : ''}
                </Text>
              </View>
              <View style={styles.statsChip}>
                <Text style={styles.statsChipLabel}>Haptic</Text>
                <Text style={styles.statsChipValue}>
                  {traceStats.hapticCount}
                  {traceStats.avgHaptic != null ? ` (${traceStats.avgHaptic}ms avg)` : ''}
                </Text>
              </View>
              <View style={styles.statsChip}>
                <Text style={styles.statsChipLabel}>Keyer</Text>
                <Text style={styles.statsChipValue}>{traceStats.keyerCount}</Text>
              </View>
              <View style={styles.statsChip}>
                <Text style={styles.statsChipLabel}>Replays</Text>
                <Text style={styles.statsChipValue}>{traceStats.replayCount}</Text>
              </View>
            </View>

            <View style={styles.latencySection}>
              <View style={styles.latencyHeader}>
                <Text style={styles.latencyTitle}>Latency telemetry</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !hasLatencySamples }}
                  disabled={!hasLatencySamples}
                  onPress={handleResetLatency}
                  style={({ pressed }) => [
                    styles.latencyResetButton,
                    pressed && styles.buttonPressed,
                    !hasLatencySamples && styles.latencyResetButtonDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.latencyResetText,
                      !hasLatencySamples && styles.latencyResetTextDisabled,
                    ]}
                  >
                    Reset
                  </Text>
                </Pressable>
              </View>

              <View style={styles.latencyGrid}>
                {LATENCY_CHANNELS.map(({ channel, label }) => {
                  const stats = latencyStatsLookup[channel];
                  const lastTimestamp =
                    stats.lastCapturedAt != null ? formatWallClock(stats.lastCapturedAt) : null;
                  const lastSource = stats.lastSource;
                  return (
                    <View key={channel} style={styles.latencyCard}>
                      <Text style={styles.latencyCardLabel}>{label}</Text>
                      <Text style={styles.latencyCardCount}>
                        {stats.count > 0 ? `${stats.count} sample${stats.count === 1 ? '' : 's'}` : 'No samples'}
                      </Text>
                      <View style={styles.latencyMetricRow}>
                        <Text style={styles.latencyMetricKey}>mean</Text>
                        <Text style={styles.latencyMetricValue}>{formatLatency(stats.meanMs)}</Text>
                      </View>
                      <View style={styles.latencyMetricRow}>
                        <Text style={styles.latencyMetricKey}>p50</Text>
                        <Text style={styles.latencyMetricValue}>{formatLatency(stats.p50Ms)}</Text>
                      </View>
                      <View style={styles.latencyMetricRow}>
                        <Text style={styles.latencyMetricKey}>p95</Text>
                        <Text style={styles.latencyMetricValue}>{formatLatency(stats.p95Ms)}</Text>
                      </View>
                      <View style={styles.latencyMetricRow}>
                        <Text style={styles.latencyMetricKey}>jitter</Text>
                        <Text style={styles.latencyMetricValue}>{formatLatency(stats.jitterMs)}</Text>
                      </View>
                      <Text style={styles.latencyLastLine}>
                        {stats.lastLatencyMs != null
                          ? `Last ${stats.lastLatencyMs} ms${lastTimestamp ? ` | ${lastTimestamp}` : ''}${lastSource ? ` (${lastSource})` : ''}`
                          : 'Last sample: n/a'}
                      </Text>
                      {channel === 'touchToTorch' && torchFailureCount > 0 ? (
                        <Text style={styles.latencyIssueText}>
                          {`Failures: ${torchFailureCount}${
                            trimmedTorchFailureReason ? ` (${trimmedTorchFailureReason})` : ''
                          }`}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          {filteredTraces.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No traces captured yet.</Text>
              <Text style={styles.emptySub}>
                Hold the keyer or replay a session prompt to log events.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={filteredTraces}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderTraceItem}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={handleManualScroll}
            />
          )}
        </View>

        <View style={[sessionStyleSheet.bottomGroup, styles.actionGroup]}>
          <View style={styles.manualSection}>
            <Text style={styles.manualHeading}>Manual output triggers</Text>

            <View style={styles.consoleMeta}>
              <Text style={styles.consoleMetaLabel}>Torch</Text>
              <Text
                style={[
                  styles.consoleMetaValue,
                  !torchSupported && styles.consoleMetaWarning,
                ]}
              >
                {torchSupported ? 'Available' : 'Unavailable'}
              </Text>
            </View>

            <View style={styles.manualToggleRow}>
              <View style={styles.manualToggleItem}>
                <Text style={styles.manualToggleLabel}>Audio</Text>
                <Switch
                  value={manualOptions.audioEnabled}
                  onValueChange={handleManualToggle('audioEnabled')}
                  trackColor={{ true: lessonColors.blueNeon, false: lessonColors.border }}
                  thumbColor={manualOptions.audioEnabled ? lessonColors.blueNeon : devConsoleTheme.switchThumb}
                />
              </View>

              <View style={styles.manualToggleItem}>
                <Text style={styles.manualToggleLabel}>Haptics</Text>
                <Switch
                  value={manualOptions.hapticsEnabled}
                  onValueChange={handleManualToggle('hapticsEnabled')}
                  trackColor={{ true: lessonColors.blueNeon, false: lessonColors.border }}
                  thumbColor={manualOptions.hapticsEnabled ? lessonColors.blueNeon : devConsoleTheme.switchThumb}
                />
              </View>

              <View style={styles.manualToggleItem}>
                <Text style={styles.manualToggleLabel}>Flash</Text>
                <Switch
                  value={manualOptions.lightEnabled}
                  onValueChange={handleManualToggle('lightEnabled')}
                  trackColor={{ true: lessonColors.blueNeon, false: lessonColors.border }}
                  thumbColor={manualOptions.lightEnabled ? lessonColors.blueNeon : devConsoleTheme.switchThumb}
                />
              </View>

              <View
                style={[
                  styles.manualToggleItem,
                  !torchSupported && styles.manualToggleDisabled,
                ]}
              >
                <Text style={styles.manualToggleLabel}>Torch</Text>
                <Switch
                  value={torchSupported ? manualOptions.torchEnabled : false}
                  onValueChange={handleManualToggle('torchEnabled')}
                  disabled={!torchSupported}
                  trackColor={{ true: lessonColors.blueNeon, false: lessonColors.border }}
                  thumbColor={
                    torchSupported && manualOptions.torchEnabled
                      ? lessonColors.blueNeon
                      : devConsoleTheme.switchThumb
                  }
                />
              </View>
            </View>

            <View style={styles.manualInputsRow}>
              <View style={styles.manualInputGroup}>
                <Text style={styles.manualInputLabel}>Pattern</Text>
                <TextInput
                  value={patternInput}
                  onChangeText={handlePatternChange}
                  placeholder={DEFAULT_PATTERN}
                  placeholderTextColor={lessonColors.textDim}
                  style={styles.manualInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.manualInputGroupSmall}>
                <Text style={styles.manualInputLabel}>WPM</Text>
                <TextInput
                  value={wpmInput}
                  onChangeText={handleWpmChange}
                  keyboardType="numeric"
                  placeholder={manualWpm.toString()}
                  placeholderTextColor={lessonColors.textDim}
                  style={styles.manualInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.manualInputsRow}>
              <View style={styles.manualInputGroupSmall}>
                <Text style={styles.manualInputLabel}>Flash offset (ms)</Text>
                <TextInput
                  value={flashOffsetInput}
                  onChangeText={handleFlashOffsetChange}
                  onBlur={resetFlashOffsetInput}
                  keyboardType="numeric"
                  placeholder={flashOffsetMs.toString()}
                  placeholderTextColor={lessonColors.textDim}
                  style={styles.manualInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.manualInputGroupSmall}>
                <Text style={styles.manualInputLabel}>Haptic offset (ms)</Text>
                <TextInput
                  value={hapticOffsetInput}
                  onChangeText={handleHapticOffsetChange}
                  onBlur={resetHapticOffsetInput}
                  keyboardType="numeric"
                  placeholder={hapticOffsetMs.toString()}
                  placeholderTextColor={lessonColors.textDim}
                  style={styles.manualInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.buttonRow}>
              <Pressable
                onPress={() => triggerPulse(1)}
                style={({ pressed }) => [
                  styles.button,
                  styles.actionButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.buttonText}>Tap Dot</Text>
              </Pressable>
              <Pressable
                onPress={() => triggerPulse(3)}
                style={({ pressed }) => [
                  styles.button,
                  styles.actionButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.buttonText}>Tap Dash</Text>
              </Pressable>
            </View>

            <View style={styles.buttonRow}>
              <Pressable
                onPress={triggerReplay}
                style={({ pressed }) => [
                  styles.buttonSecondary,
                  styles.actionButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.buttonSecondaryText}>Play Pattern</Text>
              </Pressable>
              <Pressable
                onPress={triggerStop}
                style={({ pressed }) => [
                  styles.buttonSecondary,
                  styles.actionButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.buttonSecondaryText}>Stop Playback</Text>
              </Pressable>
            </View>

            <Text style={styles.manualHint}>
              Pattern supports dots, dashes, and spaces. Use offsets to tune flash/haptic timing per device.
            </Text>
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Outputs tracing</Text>
            <Switch
              value={outputsTracingEnabled}
              onValueChange={setOutputsTracingEnabled}
              trackColor={{ true: lessonColors.blueNeon, false: lessonColors.border }}
              thumbColor={outputsTracingEnabled ? lessonColors.blueNeon : devConsoleTheme.switchThumb}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Auto-scroll</Text>
            <Switch
              value={autoScroll}
              onValueChange={setAutoScroll}
              trackColor={{ true: lessonColors.blueNeon, false: lessonColors.border }}
              thumbColor={autoScroll ? lessonColors.blueNeon : devConsoleTheme.switchThumb}
            />
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              onPress={handleExport}
              disabled={filteredTraces.length === 0}
              style={({ pressed }) => [
                styles.buttonSecondary,
                styles.actionButton,
                pressed && styles.buttonPressed,
                filteredTraces.length === 0 && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.buttonSecondaryText}>Export JSON</Text>
            </Pressable>

            <Pressable
              onPress={clearTraces}
              style={({ pressed }) => [
                styles.button,
                styles.actionButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.buttonText}>Clear trace buffer</Text>
            </Pressable>
          </View>

        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: lessonColors.textDim,
    marginTop: spacing(1),
    textAlign: 'center',
  },
  traceListWrapper: {
    alignSelf: 'stretch',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  listContent: {
    paddingBottom: spacing(2),
    gap: spacing(2),
  },
  logItem: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: spacing(3),
    gap: spacing(1.5),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing(1.5),
  },
  logLabel: {
    flex: 1,
    color: lessonColors.text,
    fontWeight: '700',
    textAlign: 'left',
  },
  logTimestamps: {
    alignItems: 'flex-end',
  },
  logTimestamp: {
    color: lessonColors.textDim,
    fontSize: 12,
    textAlign: 'right',
  },
  logTimestampMonotonic: {
    color: lessonColors.textDim,
    fontSize: 12,
    textAlign: 'right',
  },
  logPayload: {
    color: lessonColors.text,
    fontFamily: 'Courier',
    fontSize: 12,
    backgroundColor: devConsoleTheme.subtle,
    borderRadius: theme.radius.md,
    padding: spacing(2),
  },
  filterControls: {
    alignSelf: 'stretch',
    gap: spacing(1),
    marginBottom: spacing(1.5),
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(1),
  },
  filterChip: {
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(1.5),
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: devConsoleTheme.panel,
  },
  filterChipActive: {
    backgroundColor: lessonColors.blueNeon,
    borderColor: lessonColors.blueNeon,
  },
  filterChipText: {
    color: lessonColors.text,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: theme.colors.background,
  },
  searchInput: {
    backgroundColor: devConsoleTheme.panel,
    color: lessonColors.text,
    borderRadius: theme.radius.md,
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(1.5),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  filterSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterSummary: {
    color: lessonColors.textDim,
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(1),
  },
  emptyText: {
    color: lessonColors.text,
    fontWeight: '700',
  },
  emptySub: {
    color: lessonColors.textDim,
    textAlign: 'center',
  },
  actionGroup: {
    gap: spacing(2),
  },
  manualSection: {
    alignSelf: 'stretch',
    padding: spacing(2),
    borderRadius: theme.radius.lg,
    backgroundColor: devConsoleTheme.chip,
    gap: spacing(1.5),
  },
  manualHeading: {
    color: lessonColors.text,
    fontWeight: '700',
  },
  consoleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing(0.5),
  },
  consoleMetaLabel: {
    color: lessonColors.textDim,
    fontSize: 12,
  },
  consoleMetaValue: {
    color: lessonColors.text,
    fontWeight: '600',
  },
  consoleMetaWarning: {
    color: theme.colors.accent,
  },
  manualToggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(1.5),
  },
  manualToggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing(0.5),
    paddingHorizontal: spacing(1.25),
    borderRadius: theme.radius.md,
    backgroundColor: devConsoleTheme.panel,
    gap: spacing(0.75),
  },
  manualToggleLabel: {
    color: lessonColors.text,
    fontWeight: '600',
  },
  manualToggleDisabled: {
    opacity: 0.5,
  },
  manualInputsRow: {
    flexDirection: 'row',
    gap: spacing(1),
  },
  manualInputGroup: {
    flex: 1,
    gap: spacing(0.5),
  },
  manualInputGroupSmall: {
    width: 88,
    gap: spacing(0.5),
  },
  manualInputLabel: {
    color: lessonColors.textDim,
    fontSize: 12,
  },
  manualInput: {
    backgroundColor: devConsoleTheme.panel,
    color: lessonColors.text,
    borderRadius: theme.radius.md,
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(1.25),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  manualHint: {
    color: lessonColors.textDim,
    fontSize: 12,
  },
  quickFiltersRow: {
    flexDirection: 'row',
    gap: spacing(1),
    flexWrap: 'wrap',
  },
  quickFilterChip: {
    paddingVertical: spacing(0.5),
    paddingHorizontal: spacing(1.25),
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: devConsoleTheme.panel,
  },
  quickFilterChipActive: {
    backgroundColor: lessonColors.blueNeon,
    borderColor: lessonColors.blueNeon,
  },
  quickFilterChipText: {
    color: lessonColors.text,
    fontWeight: '600',
  },
  quickFilterChipTextActive: {
    color: theme.colors.background,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(1),
    marginTop: spacing(1),
  },
  statsChip: {
    backgroundColor: devConsoleTheme.panel,
    borderRadius: theme.radius.md,
    paddingVertical: spacing(0.75),
    paddingHorizontal: spacing(1.25),
    gap: spacing(0.25),
  },
  statsChipLabel: {
    color: lessonColors.textDim,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statsChipValue: {
    color: lessonColors.text,
    fontWeight: '700',
  },
  latencySection: {
    marginTop: spacing(2),
    gap: spacing(1.5),
  },
  latencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  latencyTitle: {
    color: lessonColors.text,
    fontWeight: '700',
  },
  latencyResetButton: {
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.75),
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: devConsoleTheme.panel,
  },
  latencyResetButtonDisabled: {
    opacity: 0.5,
  },
  latencyResetText: {
    color: lessonColors.blueNeon,
    fontWeight: '600',
  },
  latencyResetTextDisabled: {
    color: lessonColors.textDim,
  },
  latencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(1),
  },
  latencyCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: devConsoleTheme.panel,
    borderRadius: theme.radius.md,
    paddingVertical: spacing(0.75),
    paddingHorizontal: spacing(1.25),
    gap: spacing(0.5),
  },
  latencyCardLabel: {
    color: lessonColors.text,
    fontWeight: '700',
  },
  latencyCardCount: {
    color: lessonColors.textDim,
    fontSize: 12,
  },
  latencyMetricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  latencyMetricKey: {
    color: lessonColors.textDim,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  latencyMetricValue: {
    color: lessonColors.text,
    fontWeight: '600',
  },
  latencyLastLine: {
    color: lessonColors.textDim,
    fontSize: 12,
  },
  latencyIssueText: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(2),
    borderRadius: theme.radius.lg,
    backgroundColor: devConsoleTheme.panel,
  },
  toggleLabel: {
    color: lessonColors.text,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(1.5),
  },
  actionButton: {
    flex: 1,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing(1.75),
    borderRadius: theme.radius.lg,
    backgroundColor: lessonColors.blueNeon,
  },
  buttonSecondary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing(1.75),
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    backgroundColor: 'transparent',
  },
  buttonText: {
    color: theme.colors.background,
    fontWeight: '700',
  },
  buttonSecondaryText: {
    color: lessonColors.text,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.84,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
