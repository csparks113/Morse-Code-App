// store/useProgressStore.ts
// -------------------------
// Minimal persistent state for tracking lesson progress.
// We keep both boolean flags (backward compatible with earlier code)
// and numeric scores (0-100) so the UI can unlock features at thresholds.
// Shape: progress[groupId][lessonId] = {
//   receive: boolean, send: boolean, receiveScore: number, sendScore: number
// }

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { thresholds } from '../theme/lessonTheme';

type LessonProgress = {
  send: boolean;
  receive: boolean;
  sendScore: number; // 0-100
  receiveScore: number; // 0-100
};
type GroupProgress = Record<string, LessonProgress>;
type ProgressState = {
  progress: Record<string, GroupProgress>;
  // Convenience: mark a path as fully complete (sets boolean and score=100)
  markComplete: (
    groupId: string,
    lessonId: string,
    kind: 'send' | 'receive',
  ) => void;
  // Set a numeric score and auto-toggle boolean when crossing thresholds
  setScore: (
    groupId: string,
    lessonId: string,
    kind: 'send' | 'receive',
    score: number,
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
          const existing: LessonProgress = group[lessonId] ?? {
            send: false,
            receive: false,
            sendScore: 0,
            receiveScore: 0,
          };
          const nextScoreKey = kind === 'send' ? 'sendScore' : 'receiveScore';
          const newScores: LessonProgress = {
            ...existing,
            [kind]: true,
            [nextScoreKey]: 100,
          } as LessonProgress;
          return {
            progress: {
              ...state.progress,
              [groupId]: {
                ...group,
                [lessonId]: newScores,
              },
            },
          };
        }),
      setScore: (groupId, lessonId, kind, score) =>
        set((state) => {
          const clamped = Math.max(0, Math.min(100, Math.round(score)));
          const group = state.progress[groupId] ?? {};
          const existing: LessonProgress = group[lessonId] ?? {
            send: false,
            receive: false,
            sendScore: 0,
            receiveScore: 0,
          };
          const next: LessonProgress = { ...existing };
          if (kind === 'send') {
            next.sendScore = clamped;
            if (!next.send && clamped >= thresholds.send) next.send = true;
          } else {
            next.receiveScore = clamped;
            if (!next.receive && clamped >= thresholds.receive)
              next.receive = true;
          }
          return {
            progress: {
              ...state.progress,
              [groupId]: { ...group, [lessonId]: next },
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
