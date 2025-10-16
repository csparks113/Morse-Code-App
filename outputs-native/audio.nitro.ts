import type { HybridObject } from 'react-native-nitro-modules';

export type PlaybackSymbol = 'dot' | 'dash';

export type ToneEnvelopeOptions = {
  attackMs?: number;
  releaseMs?: number;
};

export type ToneStartOptions = {
  toneHz: number;
  gain?: number;
  envelope?: ToneEnvelopeOptions;
};

export type WarmupOptions = {
  toneHz: number;
  gain?: number;
};

export type PlaybackRequest = {
  toneHz: number;
  unitMs: number;
  pattern: PlaybackSymbol[];
  gain?: number;
  flashEnabled?: boolean;
  hapticsEnabled?: boolean;
  torchEnabled?: boolean;
  flashBrightnessPercent?: number;
  screenBrightnessBoost?: boolean;
};

export type PlaybackDispatchPhase = 'scheduled' | 'actual';

export type PlaybackDispatchEvent = {
  phase: PlaybackDispatchPhase;
  symbol: PlaybackSymbol;
  sequence: number;
  patternStartMs: number;
  expectedTimestampMs: number;
  offsetMs: number;
  durationMs: number;
  unitMs: number;
  toneHz: number;
  scheduledTimestampMs?: number;
  leadMs?: number;
  actualTimestampMs?: number;
  monotonicTimestampMs?: number;
  startSkewMs?: number;
  batchElapsedMs?: number;
  expectedSincePriorMs?: number;
  sincePriorMs?: number;
  flashHandledNatively?: boolean;
  nativeFlashAvailable?: boolean;
};

export interface OutputsAudio extends HybridObject<{ android: 'c++' }> {
  isSupported(): boolean;
  warmup(options: WarmupOptions): void;
  startTone(options: ToneStartOptions): void;
  stopTone(): void;
  playMorse(request: PlaybackRequest): void;
  setSymbolDispatchCallback(callback: ((event: PlaybackDispatchEvent) => void) | null): void;
  setFlashOverlayState?(enabled: boolean, brightnessPercent: number): boolean;
  setScreenBrightnessBoost?(enabled: boolean): void;
  getLatestSymbolInfo?(): string | null;
  getScheduledSymbols?(): string | null;
  teardown(): void;
}

export {};
