import type { HybridObject } from 'react-native-nitro-modules';

type OutputsAudioSpec = {
  ios: 'c++';
  android: 'c++';
};

export type ToneEnvelopeOptions = {
  attackMs?: number;
  releaseMs?: number;
};

export type ToneStartOptions = {
  toneHz: number;
  gain?: number;
  envelope?: ToneEnvelopeOptions;
};

export type PlaybackSymbol = '.' | '-';

export type PlaybackRequest = {
  toneHz: number;
  unitMs: number;
  pattern: readonly PlaybackSymbol[];
  gain?: number;
};

/**
 * Nitro specification for the Outputs audio orchestrator. Native implementations
 * are expected to speak to the lowest-latency audio backend available (Audio API
 * first, Expo fallback) while exposing a consistent contract to JS.
 */
export interface OutputsAudio extends HybridObject<OutputsAudioSpec> {
  /** Return true when the preferred native backend is available on the device. */
  isSupported(): boolean;
  /** Prepares native buffers/oscillators so the first tone plays without a cold-start penalty. */
  warmup(options: ToneStartOptions): void;
  /** Starts a sustained sidetone keyed by the user (key-down path). */
  startTone(options: ToneStartOptions): void;
  /** Stops any active sidetone playback (key-up path). */
  stopTone(): void;
  /** Plays a precomputed Morse pattern using native scheduling for replay scenarios. */
  playMorse(request: PlaybackRequest): void;
  /** Releases native resources when outputs are torn down. */
  teardown(): void;
}

export default {} as OutputsAudio;
