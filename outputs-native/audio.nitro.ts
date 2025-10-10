export type PlaybackSymbol = '.' | '-';

export type ToneEnvelopeOptions = {
  attackMs?: number;
  releaseMs?: number;
};

export type ToneStartOptions = {
  toneHz: number;
  gain?: number;
  envelope?: ToneEnvelopeOptions;
};

export type PlaybackRequest = {
  toneHz: number;
  unitMs: number;
  pattern: PlaybackSymbol[];
  gain?: number;
};

export interface OutputsAudio {
  isSupported(): boolean;
  warmup(options: { toneHz: number; gain?: number }): void;
  startTone(options: ToneStartOptions): void;
  stopTone(): void;
  playMorse(request: PlaybackRequest): void;
  getLatestSymbolInfo?(): string | null;
  teardown(): void;
}

export {};
