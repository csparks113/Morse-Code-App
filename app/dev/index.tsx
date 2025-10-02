import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Pressable,
  FlatList,
  ListRenderItem,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { sessionStyleSheet, sessionContainerPadding } from '@/theme/sessionStyles';
import { colors as lessonColors, spacing } from '@/theme/lessonTheme';
import { theme } from '@/theme/theme';
import {
  useDeveloperStore,
  outputsTraceBufferSize,
  type OutputsTraceEntry,
} from '@/store/useDeveloperStore';

const TIMESTAMP_DECIMALS = 1;

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

const renderTraceItem: ListRenderItem<OutputsTraceEntry> = ({ item }) => {
  return (
    <View style={styles.logItem}>
      <View style={styles.logHeader}>
        <Text style={styles.logLabel}>{item.event}</Text>
        <View style={styles.logTimestamps}>
          <Text style={styles.logTimestamp}>{formatWallClock(item.wallClock)}</Text>
          <Text style={styles.logTimestampMonotonic}>{formatMonotonicTimestamp(item.timestamp)}</Text>
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

  const developerMode = useDeveloperStore((state) => state.developerMode);
  const outputsTracingEnabled = useDeveloperStore((state) => state.outputsTracingEnabled);
  const traces = useDeveloperStore((state) => state.traces);
  const setOutputsTracingEnabled = useDeveloperStore((state) => state.setOutputsTracingEnabled);
  const clearTraces = useDeveloperStore((state) => state.clearTraces);

  React.useEffect(() => {
    if (!developerMode) {
      router.replace('/(tabs)/settings');
    }
  }, [developerMode, router]);

  const data = React.useMemo(() => [...traces].reverse(), [traces]);

  return (
    <SafeAreaView style={sessionStyleSheet.safe} edges={['top']}> 
      <View
        style={[
          sessionStyleSheet.container,
          sessionContainerPadding(insets, { footerVariant: 'dev' }),
        ]}
      >
        <View style={sessionStyleSheet.topGroup}>
          <Text style={styles.title}>Developer Console</Text>
          <Text style={styles.subtitle}>
            Outputs tracing buffer stores the {outputsTraceBufferSize} most recent events.
          </Text>
        </View>

        <View style={[sessionStyleSheet.centerGroup, styles.traceListWrapper]}>
          {data.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No traces captured yet.</Text>
              <Text style={styles.emptySub}>Hold the keyer or replay a session prompt to log events.</Text>
            </View>
          ) : (
            <FlatList
              data={data}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderTraceItem}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>

        <View style={[sessionStyleSheet.bottomGroup, styles.actionGroup]}>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Outputs tracing</Text>
            <Switch
              value={outputsTracingEnabled}
              onValueChange={setOutputsTracingEnabled}
              trackColor={{ true: lessonColors.blueNeon, false: lessonColors.border }}
              thumbColor={outputsTracingEnabled ? lessonColors.blueNeon : '#1F2430'}
            />
          </View>

          <Pressable
            onPress={clearTraces}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Clear trace buffer</Text>
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.buttonSecondary, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonSecondaryText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: {
    color: lessonColors.text,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'left',
  },
  subtitle: {
    color: lessonColors.textDim,
    marginTop: spacing(1),
    textAlign: 'left',
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
    backgroundColor: '#181D28',
    borderRadius: theme.radius.md,
    padding: spacing(2),
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(2),
    borderRadius: theme.radius.lg,
    backgroundColor: '#1C222E',
  },
  toggleLabel: {
    color: lessonColors.text,
    fontWeight: '700',
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
});