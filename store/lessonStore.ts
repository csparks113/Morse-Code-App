import { create } from 'zustand';

interface ProgressMap {
  [char: string]: number;
} // times correct (0..3)

interface LessonState {
  progress: Record<string, ProgressMap>; // by levelId
  completedLevelIds: Set<string>;
  markAttempt: (levelId: string, ch: string, correct: boolean) => void;
  markCorrect: (levelId: string, ch: string) => void;
}

export const useLessonStore = create<LessonState>((set, get) => ({
  progress: {},
  completedLevelIds: new Set<string>(),
  markAttempt: (levelId, ch, correct) => {
    if (!correct) return; // only track positives in v1
    const p = { ...get().progress };
    const m = { ...(p[levelId] ?? {}) };
    const next = Math.min(3, (m[ch] ?? 0) + 1);
    m[ch] = next;
    p[levelId] = m;

    // if all chars in level reached 3, mark complete
    const chars = Object.keys(m);
    const all3 = chars.length > 0 && chars.every((c) => m[c] >= 3);
    const completed = new Set(get().completedLevelIds);
    if (all3) completed.add(levelId);

    set({ progress: p, completedLevelIds: completed });
  },
  markCorrect: (levelId, ch) => get().markAttempt(levelId, ch, true),
}));
