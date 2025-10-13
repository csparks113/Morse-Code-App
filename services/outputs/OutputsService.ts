import React from 'react';
import { Animated } from 'react-native';

import type { PressTracker } from '@/services/latency/pressTracker';
import { toMonotonicTime } from '@/utils/time';
import { defaultOutputsService } from './defaultOutputsService';

export type MorseSymbol = '.' | '-';

export type FlashPulseOptions = {
  enabled: boolean;
  durationMs: number;
  flashValue: Animated.Value;
  source?: string;
  torchEnabled?: boolean;
  timelineOffsetMs?: number;
  brightnessPercent?: number;
  requestedAtMs?: number;
  correlationId?: string;
  metadata?: Record<string, string | number | boolean>;
};

export type HapticSymbolOptions = {
  enabled: boolean;
  symbol: MorseSymbol;
  durationMs?: number;
  source?: string;
  timelineOffsetMs?: number;
  requestedAtMs?: number;
  correlationId?: string;
  metadata?: Record<string, string | number | boolean>;
};

export type PlaybackSymbolContext = {
  requestedAtMs: number;
  correlationId: string;
  source: string;
  dispatchPhase?: 'scheduled' | 'actual';
  nativeTimestampMs?: number | null;
  nativeDurationMs?: number | null;
  nativeOffsetMs?: number | null;
  nativeSequence?: number | null;
  monotonicTimestampMs?: number | null;
  nativeExpectedTimestampMs?: number | null;
  nativeStartSkewMs?: number | null;
  nativeBatchElapsedMs?: number | null;
  nativeExpectedSincePriorMs?: number | null;
  nativeSincePriorMs?: number | null;
  nativePatternStartMs?: number | null;
  nativeAgeMs?: number | null;
};

export type PlayMorseOptions = {
  morse: string;
  unitMs: number;
  source?: string;
  onSymbolStart?: (symbol: MorseSymbol, durationMs: number, context: PlaybackSymbolContext) => void;
  audioEnabled?: boolean;
  audioVolumePercent?: number;
};

export type KeyerOutputsOptions = {
  audioEnabled: boolean;
  hapticsEnabled: boolean;
  lightEnabled: boolean;
  torchEnabled: boolean;
  toneHz: number;
  audioVolumePercent: number;
  flashBrightnessPercent: number;
};

export type KeyerOutputsContext = {
  source?: string;
  pressTracker?: PressTracker;
};

export type KeyerOutputsHandle = {
  flashOpacity: Animated.Value;
  prepare(): Promise<void>;
  teardown(): Promise<void>;
  pressStart(timestampMs?: number): void;
  pressEnd(timestampMs?: number): void;
  updateOptions(options: KeyerOutputsOptions): void;
  cutActiveOutputs(reason?: string, metadata?: Record<string, string | number | boolean>): void;
};


export function resolvePlaybackRequestedAt(context?: PlaybackSymbolContext): number | undefined {
  if (!context) {
    return undefined;
  }
  const expectedTimestamp = context.nativeExpectedTimestampMs;
  if (typeof expectedTimestamp === 'number') {
    return toMonotonicTime(expectedTimestamp);
  }
  if (typeof context.monotonicTimestampMs === 'number') {
    return context.monotonicTimestampMs;
  }
  if (typeof context.nativeTimestampMs === 'number') {
    return toMonotonicTime(context.nativeTimestampMs);
  }
  if (typeof context.requestedAtMs === 'number') {
    return context.requestedAtMs;
  }
  return undefined;
}

export function resolvePlaybackTimelineOffset(context?: PlaybackSymbolContext): number | undefined {
  if (!context) {
    return undefined;
  }
  const expectedTimestamp = context.nativeExpectedTimestampMs;
  if (typeof expectedTimestamp === 'number' && Number.isFinite(expectedTimestamp)) {
    return undefined;
  }
  const offset = context.nativeOffsetMs;
  if (typeof offset === 'number' && Number.isFinite(offset)) {
    return offset;
  }
  return undefined;
}

export function buildPlaybackMetadata(context?: PlaybackSymbolContext): Record<string, number> | undefined {
  if (!context) {
    return undefined;
  }
  const metadata: Record<string, number> = {};
  if (typeof context.nativeTimestampMs === 'number') {
    metadata.nativeTimestampMs = context.nativeTimestampMs;
  }
  if (typeof context.nativeDurationMs === 'number') {
    metadata.nativeDurationMs = context.nativeDurationMs;
  }
  if (typeof context.nativeOffsetMs === 'number') {
    metadata.nativeOffsetMs = context.nativeOffsetMs;
  }
  if (typeof context.nativeSequence === 'number') {
    metadata.nativeSequence = context.nativeSequence;
  }
  if (typeof context.monotonicTimestampMs === 'number') {
    metadata.monotonicTimestampMs = context.monotonicTimestampMs;
  }
  if (typeof context.nativeExpectedTimestampMs === 'number') {
    metadata.nativeExpectedTimestampMs = context.nativeExpectedTimestampMs;
  }
  if (typeof context.nativeStartSkewMs === 'number') {
    metadata.nativeStartSkewMs = context.nativeStartSkewMs;
  }
  if (typeof context.nativeBatchElapsedMs === 'number') {
    metadata.nativeBatchElapsedMs = context.nativeBatchElapsedMs;
  }
  if (typeof context.nativeExpectedSincePriorMs === 'number') {
    metadata.nativeExpectedSincePriorMs = context.nativeExpectedSincePriorMs;
  }
  if (typeof context.nativeSincePriorMs === 'number') {
    metadata.nativeSincePriorMs = context.nativeSincePriorMs;
  }
  if (typeof context.nativePatternStartMs === 'number') {
    metadata.nativePatternStartMs = context.nativePatternStartMs;
  }
  if (typeof context.nativeAgeMs === 'number') {
    metadata.nativeAgeMs = context.nativeAgeMs;
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}
export interface OutputsService {
  createFlashValue(): Animated.Value;
  flashPulse(options: FlashPulseOptions): void;
  hapticSymbol(options: HapticSymbolOptions): void;
  playMorse(options: PlayMorseOptions): Promise<void>;
  stopMorse(): void;
  createKeyerOutputs(options: KeyerOutputsOptions, context?: KeyerOutputsContext): KeyerOutputsHandle;
  isTorchSupported(): boolean;
}

const OutputsServiceContext = React.createContext<OutputsService | null>(null);

export const OutputsServiceProvider: React.FC<{
  value?: OutputsService;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return React.createElement(
    OutputsServiceContext.Provider,
    { value: value ?? defaultOutputsService },
    children,
  );
};

export function useOutputsService(): OutputsService {
  const service = React.useContext(OutputsServiceContext);
  return service ?? defaultOutputsService;
}




