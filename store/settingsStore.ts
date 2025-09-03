import { create } from 'zustand';

export type Language = 'en' | 'es' | 'fr' | 'de';

interface SettingsState {
  language: Language;
  wpm: number;
  soundOn: boolean;
  setLanguage: (lng: Language) => void;
  setWpm: (n: number) => void;
  toggleSound: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: 'en',
  wpm: 20,
  soundOn: true,
  setLanguage: (language) => set({ language }),
  setWpm: (wpm) => set({ wpm }),
  toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),
}));
