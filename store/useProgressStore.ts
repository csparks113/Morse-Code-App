// store/useProgressStore.ts
// -------------------------
// Tracks lesson progress separately for send/receive completions.
// Structure: progress[groupId][lessonId] = { send: boolean, receive: boolean }

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type LessonProgress = { send: boolean; receive: boolean };
type GroupProgress = Record<string, LessonProgress>;
type ProgressState = {
  progress: Record<string, GroupProgress>;
  markComplete: (
    groupId: string,
    lessonId: string,
    kind: 'send' | 'receive',
  ) => void;
  getCompletionRatio: (groupId: string, totalLessons: number) => number;
};

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      progress: {},
      markComplete: (groupId, lessonId, kind) =>
        set((state) => {
          const group = state.progress[groupId] ?? {};
          const existing = group[lessonId] ?? { send: false, receive: false };
          return {
            progress: {
              ...state.progress,
              [groupId]: {
                ...group,
                [lessonId]: { ...existing, [kind]: true },
              },
            },
          };
        }),
      // Return average of (send+receive)/2 for each lesson, then averaged across lessons
      getCompletionRatio: (groupId, totalLessons) => {
        const group = get().progress[groupId] ?? {};
        if (totalLessons === 0) return 0;
        const sum = Object.values(group).reduce((acc, lp) => {
          const perLesson = (Number(!!lp.send) + Number(!!lp.receive)) / 2;
          return acc + perLesson;
        }, 0);
        return Math.max(0, Math.min(1, sum / totalLessons));
      },
    }),
    {
      name: 'progress',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
