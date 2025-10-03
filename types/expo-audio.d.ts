declare module 'expo-audio' {
  export namespace Audio {
    class Sound {
      loadAsync(source: any, status?: any, downloadFirst?: boolean): Promise<void>;
      unloadAsync(): Promise<void>;
      setPositionAsync(positionMillis: number): Promise<void>;
      setIsLoopingAsync(isLooping: boolean): Promise<void>;
      playAsync(): Promise<void>;
      stopAsync(): Promise<void>;
      replayAsync(status?: any): Promise<void>;
    }
    function setAudioModeAsync(mode: any): Promise<void>;
  }
  export const InterruptionModeAndroid: { DoNotMix: number };
  export const InterruptionModeIOS: { DoNotMix: number };
}
