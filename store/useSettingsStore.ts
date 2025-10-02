import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SettingsState = {
  receiveOnly: boolean;

  // Output toggles
  audioEnabled: boolean;
  lightEnabled: boolean; // flash overlay
  torchEnabled: boolean; // device flashlight
  hapticsEnabled: boolean; // vibration/taps feedback

  // Morse timing
  wpm: number; // words per minute (dot = 1200 / WPM ms)
  toneHz: number; // tone frequency in Hz
  signalTolerancePercent: number; // dot/dash tolerance window (percent)
  gapTolerancePercent: number; // gap tolerance window (percent)
  flashOffsetMs: number;
  hapticOffsetMs: number;

  setReceiveOnly: (value: boolean) => void;
  setAudioEnabled: (value: boolean) => void;
  setLightEnabled: (value: boolean) => void;
  setTorchEnabled: (value: boolean) => void;
  setHapticsEnabled: (value: boolean) => void;
  setWpm: (value: number) => void;
  setToneHz: (value: number) => void;
  setSignalTolerancePercent: (value: number) => void;
  setGapTolerancePercent: (value: number) => void;
  setFlashOffsetMs: (value: number) => void;
  setHapticOffsetMs: (value: number) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      receiveOnly: false,

      audioEnabled: true,
      lightEnabled: false,
      torchEnabled: false,
      hapticsEnabled: true,

      wpm: 12,
      toneHz: 600,
      signalTolerancePercent: 30,
      gapTolerancePercent: 50,
      flashOffsetMs: 0,
      hapticOffsetMs: 0,

      setReceiveOnly: (value) => set({ receiveOnly: value }),
      setAudioEnabled: (value) => set({ audioEnabled: value }),
      setLightEnabled: (value) => set({ lightEnabled: value }),
      setTorchEnabled: (value) => set({ torchEnabled: value }),
      setHapticsEnabled: (value) => set({ hapticsEnabled: value }),
      setWpm: (value) => {
        const clamped = Math.max(5, Math.min(60, Math.round(value)));
        set({ wpm: clamped });
      },
      setToneHz: (value) => {
        const clamped = Math.max(200, Math.min(1200, Math.round(value)));
        set({ toneHz: clamped });
      },
      setSignalTolerancePercent: (value) => {
        const clamped = Math.max(20, Math.min(60, Math.round(value)));
        set({ signalTolerancePercent: clamped });
      },
      setGapTolerancePercent: (value) => {
        const clamped = Math.max(30, Math.min(80, Math.round(value)));
        set({ gapTolerancePercent: clamped });
      },
      setFlashOffsetMs: (value) => {
        const clamped = Math.max(-300, Math.min(300, Math.round(value)));
        set({ flashOffsetMs: clamped });
      },
      setHapticOffsetMs: (value) => {
        const clamped = Math.max(-300, Math.min(300, Math.round(value)));
        set({ hapticOffsetMs: clamped });
      },
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        receiveOnly: state.receiveOnly,
        audioEnabled: state.audioEnabled,
        lightEnabled: state.lightEnabled,
        torchEnabled: state.torchEnabled,
        hapticsEnabled: state.hapticsEnabled,
        wpm: state.wpm,
        toneHz: state.toneHz,
        signalTolerancePercent: state.signalTolerancePercent,
        gapTolerancePercent: state.gapTolerancePercent,
        flashOffsetMs: state.flashOffsetMs,
        hapticOffsetMs: state.hapticOffsetMs,
      }),
    },
  ),
);
