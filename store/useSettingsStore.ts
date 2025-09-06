import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SettingsState = {
  receiveOnly: boolean;

  // Toggles
  audioEnabled: boolean;
  lightEnabled: boolean; // future: flash overlay or torch
  hapticsEnabled: boolean; // vibration/taps feedback

  // Morse timing
  wpm: number; // words per minute (dot = 1200/wpm ms)
  toneHz: number; // tone frequency in Hz

  setReceiveOnly: (value: boolean) => void;
  setAudioEnabled: (value: boolean) => void;
  setLightEnabled: (value: boolean) => void;
  setHapticsEnabled: (value: boolean) => void;
  setWpm: (value: number) => void;
  setToneHz: (value: number) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      receiveOnly: false,

      audioEnabled: true,
      lightEnabled: false,
      hapticsEnabled: true,

      wpm: 15,
      toneHz: 600,

      setReceiveOnly: (value) => set({ receiveOnly: value }),
      setAudioEnabled: (value) => set({ audioEnabled: value }),
      setLightEnabled: (value) => set({ lightEnabled: value }),
      setHapticsEnabled: (value) => set({ hapticsEnabled: value }),
      setWpm: (value) => {
        const clamped = Math.max(5, Math.min(60, Math.round(value)));
        set({ wpm: clamped });
      },
      setToneHz: (value) => {
        const clamped = Math.max(200, Math.min(1200, Math.round(value)));
        set({ toneHz: clamped });
      },
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        receiveOnly: state.receiveOnly,
        audioEnabled: state.audioEnabled,
        lightEnabled: state.lightEnabled,
        hapticsEnabled: state.hapticsEnabled,
        wpm: state.wpm,
        toneHz: state.toneHz,
      }),
    },
  ),
);
