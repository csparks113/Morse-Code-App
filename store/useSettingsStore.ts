import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  SETTINGS_DEFAULTS,
  clampSettingValue,
  SettingsLimitKey,
} from '@/constants/appConfig';

type SettingsState = {
  receiveOnly: boolean;

  // Output toggles
  audioEnabled: boolean;
  lightEnabled: boolean;
  torchEnabled: boolean;
  hapticsEnabled: boolean;

  // Output tuning
  audioVolumePercent: number;
  flashBrightnessPercent: number;

  // Morse timing
  wpm: number;
  toneHz: number;
  signalTolerancePercent: number;
  gapTolerancePercent: number;
  flashOffsetMs: number;
  hapticOffsetMs: number;

  setReceiveOnly: (value: boolean) => void;
  setAudioEnabled: (value: boolean) => void;
  setLightEnabled: (value: boolean) => void;
  setTorchEnabled: (value: boolean) => void;
  setHapticsEnabled: (value: boolean) => void;
  setAudioVolumePercent: (value: number) => void;
  setFlashBrightnessPercent: (value: number) => void;
  setWpm: (value: number) => void;
  setToneHz: (value: number) => void;
  setSignalTolerancePercent: (value: number) => void;
  setGapTolerancePercent: (value: number) => void;
  setFlashOffsetMs: (value: number) => void;
  setHapticOffsetMs: (value: number) => void;
};

const clamp = (key: SettingsLimitKey, raw: number) => {
  const numeric = Number(raw);
  const fallback = SETTINGS_DEFAULTS[key];
  const value = Number.isFinite(numeric) ? numeric : fallback;
  return clampSettingValue(key, Math.round(value));
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      receiveOnly: SETTINGS_DEFAULTS.receiveOnly,

      audioEnabled: SETTINGS_DEFAULTS.audioEnabled,
      lightEnabled: SETTINGS_DEFAULTS.lightEnabled,
      torchEnabled: SETTINGS_DEFAULTS.torchEnabled,
      hapticsEnabled: SETTINGS_DEFAULTS.hapticsEnabled,

      audioVolumePercent: SETTINGS_DEFAULTS.audioVolumePercent,
      flashBrightnessPercent: SETTINGS_DEFAULTS.flashBrightnessPercent,

      wpm: SETTINGS_DEFAULTS.wpm,
      toneHz: SETTINGS_DEFAULTS.toneHz,
      signalTolerancePercent: SETTINGS_DEFAULTS.signalTolerancePercent,
      gapTolerancePercent: SETTINGS_DEFAULTS.gapTolerancePercent,
      flashOffsetMs: SETTINGS_DEFAULTS.flashOffsetMs,
      hapticOffsetMs: SETTINGS_DEFAULTS.hapticOffsetMs,

      setReceiveOnly: (value) => set({ receiveOnly: value }),
      setAudioEnabled: (value) => set({ audioEnabled: value }),
      setLightEnabled: (value) => set({ lightEnabled: value }),
      setTorchEnabled: (value) => set({ torchEnabled: value }),
      setHapticsEnabled: (value) => set({ hapticsEnabled: value }),
      setAudioVolumePercent: (value) => set({ audioVolumePercent: clamp('audioVolumePercent', value) }),
      setFlashBrightnessPercent: (value) => set({ flashBrightnessPercent: clamp('flashBrightnessPercent', value) }),
      setWpm: (value) => set({ wpm: clamp('wpm', value) }),
      setToneHz: (value) => set({ toneHz: clamp('toneHz', value) }),
      setSignalTolerancePercent: (value) => set({ signalTolerancePercent: clamp('signalTolerancePercent', value) }),
      setGapTolerancePercent: (value) => set({ gapTolerancePercent: clamp('gapTolerancePercent', value) }),
      setFlashOffsetMs: (value) => set({ flashOffsetMs: clamp('flashOffsetMs', value) }),
      setHapticOffsetMs: (value) => set({ hapticOffsetMs: clamp('hapticOffsetMs', value) }),
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
        audioVolumePercent: state.audioVolumePercent,
        flashBrightnessPercent: state.flashBrightnessPercent,
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


