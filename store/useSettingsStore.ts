// store/useSettingsStore.ts
// -------------------------
// Simple global settings store using Zustand.
// Right now we only track "receiveOnly". Later you can add audio/light/haptics toggles.

import { create } from "zustand";

type SettingsState = {
  receiveOnly: boolean;
  setReceiveOnly: (value: boolean) => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  receiveOnly: false, // default: show both Send & Receive
  setReceiveOnly: (value) => set({ receiveOnly: value }),
}));