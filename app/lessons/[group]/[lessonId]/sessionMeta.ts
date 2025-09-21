/**
 * SESSION META HELPERS
 * --------------------
 * OVERVIEW
 * This module defines the shape of metadata (`SessionMeta`) that the
 * Send/Receive screens need, and provides a builder function
 * `buildSessionMeta(groupId, lessonId)`.
 *
 * WHAT IT DOES
 * - For **lessons**: returns the label ("Lesson 1 - E & T"), the pool of
 *   characters (['E','T']), and marks isChallenge = false.
 * - For **challenges**: returns headerTop = "Challenge", builds a pool of
 *   *all characters learned so far* in that group, and marks isChallenge = true.
 *
 * WHY
 * - This abstraction keeps session screens simple: they just consume a
 *   normalized object with `headerTop`, `pool`, and `isChallenge`.
 */

import { getGroupById, getLesson } from '@/data/lessons';

export type SessionMeta = {
  headerTop: string;
  pool: string[];
  isChallenge: boolean;
  lessonLabel?: string;
};

export function buildSessionMeta(
  groupId: string,
  lessonId?: string,
): SessionMeta {
  const group = getGroupById(groupId);

  // If invalid group or no lessonId, return an empty state
  if (!group || !lessonId) {
    return { headerTop: 'Lesson', pool: [], isChallenge: false };
  }

  // --- CHALLENGE PATH -------------------------------------------------------
  if (lessonId.startsWith('ch-')) {
    /**
     * Collect all characters from lessons up to this challenge.
     * Example: if this is Challenge 2, include chars from all lessons
     * in the group before this challenge.
     */
    const challengeIndex = Number.parseInt(lessonId.replace('ch-', ''), 10) || 1;

    // Collect characters from lessons unlocked prior to this challenge.
    const chars: string[] = [];
    let lessonsCounted = 0;
    for (const lesson of group.lessons) {
      if (lesson.id.startsWith('ch-')) {
        const idx = Number.parseInt(lesson.id.replace('ch-', ''), 10) || 0;
        if (idx >= challengeIndex) break;
        continue;
      }

      chars.push(...lesson.chars);
      lessonsCounted += 1;

      if (lessonsCounted >= challengeIndex * 2) break; // challenges arrive every 2 lessons
    }

    const uniqueChars = Array.from(new Set(chars));

    return {
      headerTop: 'Challenge',
      pool: uniqueChars,
      isChallenge: true,
    };
  }

  // --- LESSON PATH ----------------------------------------------------------
  const lesson = getLesson(groupId, lessonId);
  const label = lesson
    ? `${lesson.label} - ${lesson.chars.join(' & ')}`
    : 'Lesson';

  return {
    headerTop: label,
    pool: lesson?.chars ?? [],
    isChallenge: false,
    lessonLabel: lesson?.label,
  };
}
