import { create } from 'zustand';

type SettingsState = {
  receiveOnly: boolean;

  // New toggles we discussed
  audioEnabled: boolean;
  lightEnabled: boolean; // (future) use device flashlight for “flash” feedback
  hapticsEnabled: boolean; // vibration/taps feedback

  setReceiveOnly: (value: boolean) => void;
  setAudioEnabled: (value: boolean) => void;
  setLightEnabled: (value: boolean) => void;
  setHapticsEnabled: (value: boolean) => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  receiveOnly: false,

  audioEnabled: true,
  lightEnabled: false,
  hapticsEnabled: true,

  setReceiveOnly: (value) => set({ receiveOnly: value }),
  setAudioEnabled: (value) => set({ audioEnabled: value }),
  setLightEnabled: (value) => set({ lightEnabled: value }),
  setHapticsEnabled: (value) => set({ hapticsEnabled: value }),
}));
