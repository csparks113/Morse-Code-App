import { create } from 'zustand';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { nowMs } from '@/utils/time';

export const latencyChannels = ['touchToTone', 'touchToHaptic', 'touchToFlash', 'touchToTorch'] as const;
export type LatencyChannel = (typeof latencyChannels)[number];

type DeviceMetadata = {
  platform: typeof Platform.OS;
  osVersion: string | number;
  expoSdkVersion: string | null;
  appOwnership: string | null;
  executionEnvironment: string | null;
  jsEngine: 'hermes' | 'jsc' | 'unknown';
  isDevBuild: boolean;
  isDevClient: boolean;
};

export type LatencySample = {
  latencyMs: number;
  capturedAt: number;
  requestedAt?: number;
  source?: string | null;
  correlationId?: string | null;
  metadata?: Record<string, string | number | boolean> | null;
  device: DeviceMetadata;
};

export type LatencyStats = {
  count: number;
  meanMs: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  jitterMs: number | null;
  lastLatencyMs: number | null;
  lastCapturedAt: number | null;
  lastSource: string | null;
  lastCorrelationId: string | null;
};

type ChannelState = {
  samples: LatencySample[];
  stats: LatencyStats;
};

type RecordSampleInput = {
  latencyMs: number;
  requestedAt?: number;
  source?: string | null;
  correlationId?: string | null;
  metadata?: Record<string, string | number | boolean> | null;
};

type LatencyState = {
  channels: Record<LatencyChannel, ChannelState>;
  device: DeviceMetadata;
  recordSample: (channel: LatencyChannel, sample: RecordSampleInput) => void;
  reset: (channel?: LatencyChannel) => void;
};

const MAX_SAMPLES = 200;

const createEmptyStats = (): LatencyStats => ({
  count: 0,
  meanMs: null,
  p50Ms: null,
  p95Ms: null,
  jitterMs: null,
  lastLatencyMs: null,
  lastCapturedAt: null,
  lastSource: null,
  lastCorrelationId: null,
});

const createEmptyChannel = (): ChannelState => ({
  samples: [],
  stats: createEmptyStats(),
});

const createInitialChannels = (): Record<LatencyChannel, ChannelState> => ({
  touchToTone: createEmptyChannel(),
  touchToHaptic: createEmptyChannel(),
  touchToFlash: createEmptyChannel(),
  touchToTorch: createEmptyChannel(),
});

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  if (sorted.length === 1) {
    return sorted[0];
  }

  const target = (sorted.length - 1) * fraction;
  const lower = Math.floor(target);
  const upper = Math.ceil(target);
  if (lower === upper) {
    return sorted[lower];
  }

  const weight = target - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

function computeStats(samples: LatencySample[]): LatencyStats {
  if (samples.length === 0) {
    return createEmptyStats();
  }

  const values = samples.map((sample) => sample.latencyMs).sort((a, b) => a - b);
  const total = values.reduce((acc, value) => acc + value, 0);
  const mean = total / values.length;
  const p50 = percentile(values, 0.5);
  const p95 = percentile(values, 0.95);
  const jitter = Math.max(0, p95 - p50);
  const lastSample = samples[samples.length - 1] ?? null;

  return {
    count: values.length,
    meanMs: Math.round(mean),
    p50Ms: Math.round(p50),
    p95Ms: Math.round(p95),
    jitterMs: Math.round(jitter),
    lastLatencyMs: lastSample ? Math.round(lastSample.latencyMs) : null,
    lastCapturedAt: lastSample?.capturedAt ?? null,
    lastSource: lastSample?.source ?? null,
    lastCorrelationId: lastSample?.correlationId ?? null,
  };
}

function resolveJsEngine(): 'hermes' | 'jsc' | 'unknown' {
  const globalRef = globalThis as { HermesInternal?: unknown; __turboModuleProxy?: unknown };
  if (globalRef.HermesInternal != null) {
    return 'hermes';
  }
  if (globalRef.__turboModuleProxy != null) {
    return 'jsc';
  }
  return 'unknown';
}

function getDeviceMetadata(): DeviceMetadata {
  const expoConfig = Constants.expoConfig ?? null;
  const expoSdkVersion = expoConfig?.sdkVersion ?? Constants.expoVersion ?? null;
  const appOwnership = Constants.appOwnership ?? null;
  const executionEnvironment = Constants.executionEnvironment ?? null;
  const jsEngine = resolveJsEngine();
  const isDevBuild = typeof __DEV__ === 'boolean' ? __DEV__ : false;
  const isDevClient = executionEnvironment === 'bare' && isDevBuild;

  return Object.freeze({
    platform: Platform.OS,
    osVersion: Platform.Version,
    expoSdkVersion,
    appOwnership,
    executionEnvironment,
    jsEngine,
    isDevBuild,
    isDevClient,
  });
}

export const useOutputsLatencyStore = create<LatencyState>((set, get) => ({
  channels: createInitialChannels(),
  device: getDeviceMetadata(),
  recordSample: (channel, sample) => {
    const numericLatency = Number(sample.latencyMs);
    if (!Number.isFinite(numericLatency)) {
      return;
    }

    const latencyMs = Math.max(0, numericLatency);
    const device = get().device;
    const entry: LatencySample = {
      latencyMs,
      capturedAt: nowMs(),
      requestedAt: sample.requestedAt,
      source: sample.source ?? null,
      correlationId: sample.correlationId ?? null,
      metadata: sample.metadata ?? null,
      device,
    };

    set((state) => {
      const current = state.channels[channel];
      const nextSamples = [...current.samples, entry];
      if (nextSamples.length > MAX_SAMPLES) {
        nextSamples.splice(0, nextSamples.length - MAX_SAMPLES);
      }

      return {
        channels: {
          ...state.channels,
          [channel]: {
            samples: nextSamples,
            stats: computeStats(nextSamples),
          },
        },
      };
    });
  },
  reset: (channel) => {
    if (channel) {
      set((state) => ({
        channels: {
          ...state.channels,
          [channel]: createEmptyChannel(),
        },
      }));
      return;
    }

    set(() => ({
      channels: createInitialChannels(),
    }));
  },
}));

export function recordLatencySample(
  channel: LatencyChannel,
  latencyMs: number,
  extra?: Omit<RecordSampleInput, 'latencyMs'>,
): void {
  useOutputsLatencyStore.getState().recordSample(channel, {
    latencyMs,
    ...(extra ?? {}),
  });
}

export function resetLatencyMetrics(channel?: LatencyChannel): void {
  useOutputsLatencyStore.getState().reset(channel);
}

export function getLatencyStats(channel: LatencyChannel): LatencyStats {
  return useOutputsLatencyStore.getState().channels[channel].stats;
}

export function getLatencySamples(channel: LatencyChannel): LatencySample[] {
  return useOutputsLatencyStore.getState().channels[channel].samples;
}

export function getLatencyDeviceMetadata(): DeviceMetadata {
  return useOutputsLatencyStore.getState().device;
}

export function useLatencyStats(channel: LatencyChannel): LatencyStats {
  return useOutputsLatencyStore((state) => state.channels[channel].stats);
}
