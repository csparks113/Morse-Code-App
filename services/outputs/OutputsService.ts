import React from 'react';
import { Animated } from 'react-native';

import type { PressTracker } from '@/services/latency/pressTracker';
import { defaultOutputsService } from './defaultOutputsService';

export type MorseSymbol = '.' | '-';

export type FlashPulseOptions = {
  enabled: boolean;
  durationMs: number;
  flashValue: Animated.Value;
  source?: string;
  requestedAtMs?: number;
  correlationId?: string;
  metadata?: Record<string, string | number | boolean>;
};

export type HapticSymbolOptions = {
  enabled: boolean;
  symbol: MorseSymbol;
  durationMs?: number;
  source?: string;
  requestedAtMs?: number;
  correlationId?: string;
  metadata?: Record<string, string | number | boolean>;
};

export type PlaybackSymbolContext = {
  requestedAtMs: number;
  correlationId: string;
  source: string;
};

export type PlayMorseOptions = {
  morse: string;
  unitMs: number;
  source?: string;
  onSymbolStart?: (symbol: MorseSymbol, durationMs: number, context: PlaybackSymbolContext) => void;
};

export type KeyerOutputsOptions = {
  audioEnabled: boolean;
  hapticsEnabled: boolean;
  lightEnabled: boolean;
  torchEnabled: boolean;
  toneHz: number;
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
};

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
