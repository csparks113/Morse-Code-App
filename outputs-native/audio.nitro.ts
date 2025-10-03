import type { HybridObject } from 'react-native-nitro-modules';

type OutputsAudioSpec = {
  ios: 'c++';
  android: 'c++';
};

/**
 * Placeholder Nitro specification for the upcoming Outputs audio orchestrator.
 * Concrete native implementations will replace these stubs once the audio
 * engine migrates onto Nitro modules.
 */
export interface OutputsAudio extends HybridObject<OutputsAudioSpec> {
  warmup(): void;
  teardown(): void;
}

export default {} as OutputsAudio;
