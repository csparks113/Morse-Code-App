import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useOutputsService } from '@/services/outputs/OutputsService';
import { useOutputsDiagnosticsStore } from '@/store/useOutputsDiagnosticsStore';
import { useDeveloperStore } from '@/store/useDeveloperStore';
import { colors, surfaces, borders, spacing, status, sessionControlTheme } from '@/theme/lessonTheme';
import { withAlpha, fontWeight, typography } from '@/theme/tokens';

function formatLatency(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.round(value));
}

export default function TorchDiagnosticsNotice(): React.ReactElement | null {
  const { t } = useTranslation('session');
  const outputs = useOutputsService();
  const developerMode = useDeveloperStore((state) => state.developerMode);
  const torchSupported = React.useMemo(() => outputs.isTorchSupported(), [outputs]);

  const torchPulseCount = useOutputsDiagnosticsStore((state) => state.torchPulseCount);
  const totalLatencyMs = useOutputsDiagnosticsStore((state) => state.totalLatencyMs);
  const lastLatencyMs = useOutputsDiagnosticsStore((state) => state.lastLatencyMs);
  const torchFailureCount = useOutputsDiagnosticsStore((state) => state.torchFailureCount);
  const lastFailureReason = useOutputsDiagnosticsStore((state) => state.lastFailureReason);

  const averageLatency = React.useMemo(() => {
    if (torchPulseCount <= 0) {
      return null;
    }
    const avg = totalLatencyMs / torchPulseCount;
    return formatLatency(avg);
  }, [torchPulseCount, totalLatencyMs]);

  const lastLatency = formatLatency(lastLatencyMs);
  const hasFailures = torchFailureCount > 0;
  const fallbackReason = lastFailureReason?.trim() || t('torchFailureUnknown');

  if (!developerMode) {
    return null;
  }

  const containerStyle = [
    styles.container,
    !torchSupported || hasFailures ? styles.warning : null,
  ];

  return (
    <View style={containerStyle} accessibilityRole="text">
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('torchDiagnosticsTitle')}</Text>
        <Text
          style={[
            styles.status,
            torchSupported ? styles.statusAvailable : styles.statusUnavailable,
          ]}
        >
          {torchSupported ? t('torchStatusAvailable') : t('torchStatusUnavailable')}
        </Text>
      </View>

      {torchPulseCount > 0 ? (
        <View style={styles.metricsRow}>
          <Text style={styles.metric}>{t('torchPulseCount', { count: torchPulseCount })}</Text>
          {averageLatency != null ? (
            <Text style={styles.metric}>{t('torchAverageLatency', { latency: averageLatency })}</Text>
          ) : null}
          {lastLatency != null ? (
            <Text style={styles.metric}>{t('torchLastLatency', { latency: lastLatency })}</Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.message}>{t('torchNoTelemetry')}</Text>
      )}

      {!torchSupported ? (
        <Text style={styles.message}>{t('torchFallbackMessage')}</Text>
      ) : null}

      {hasFailures ? (
        <Text style={styles.message}>
          {t('torchFailureMessage', { count: torchFailureCount, reason: fallbackReason })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    marginTop: spacing(1),
    paddingVertical: spacing(1),
    paddingHorizontal: spacing(1.5),
    borderRadius: sessionControlTheme.outputToggle.borderRadius,
    backgroundColor: surfaces.sunken,
    borderWidth: 1,
    borderColor: borders.subtle,
    gap: spacing(0.5),
  },
  warning: {
    borderColor: status.warning,
    backgroundColor: withAlpha(status.warning, 0.12),
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  title: {
    color: colors.text,
    fontSize: typography.label,
    fontWeight: fontWeight.bold,
  },
  status: {
    fontSize: typography.label,
    fontWeight: fontWeight.bold,
  },
  statusAvailable: {
    color: colors.blueNeon,
  },
  statusUnavailable: {
    color: status.warning,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing(1.25),
    rowGap: spacing(0.5),
  },
  metric: {
    color: colors.text,
    fontSize: typography.label,
  },
  message: {
    color: colors.textDim,
    fontSize: typography.label,
  },
});



