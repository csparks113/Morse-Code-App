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
 * - For **reviews**: lessonId is "<n>-review". Returns headerTop = "Lesson n — Review",
 *   pool = the characters of lesson n, isChallenge = false.
 * - For **challenges**: lessonId is "challenge-<k>" or "challenge-final".
 *   Builds a pool of *all characters learned so far* in that group:
 *   - "challenge-<k>": chars from the first (k*2) lessons in the group
 *   - "challenge-final": chars from all lessons in the group
 *   and marks isChallenge = true.
 *
 * WHY
 * - This abstraction keeps session screens simple: they just consume a
 *   normalized object with `headerTop`, `pool`, and `isChallenge`.
 */

/**
 * SESSION META HELPERS (updated for Review/Challenge)
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

  if (!group || !lessonId) {
    return { headerTop: 'Lesson', pool: [], isChallenge: false };
  }

  const lid = String(lessonId).toLowerCase();

// --- CHALLENGE ------------------------------------------------------------
if (String(lessonId).startsWith('challenge-')) {
  const idxMatch = String(lessonId).match(/^challenge-(\d+|final)$/);
  if (idxMatch) {
    const token = idxMatch[1];
    const lessonsArr = group.lessons;
    let boundaryIdx: number;

    if (token === 'final') {
      boundaryIdx = lessonsArr.length - 1;
    } else {
      const challengeIndex = Math.max(1, parseInt(token, 10)); // 1-based
      // Reviews start after L2; every 2 reviews => after L3, L5, L7...
      boundaryIdx = Math.min(lessonsArr.length - 1, challengeIndex * 2);
    }

    // Collect ALL learned chars up to boundary (inclusive), in order, no dups
    const ordered: string[] = [];
    for (let i = 0; i <= boundaryIdx; i += 1) {
      for (const c of lessonsArr[i].chars) {
        const up = c.toUpperCase();
        if (!ordered.includes(up)) ordered.push(up);
      }
    }

    // ✅ INCLUDE the last two learned as well (no slicing)
    const pool = ordered;

    return {
      headerTop: 'Challenge',
      pool,
      isChallenge: true,
    };
  }
}

  // --- REVIEW PATH ----------------------------------------------------------
  // Accepts: "<n>-review" -> header "Review", pool = cumulative up to lesson n
  const reviewMatch = lid.match(/^(\d+)-review$/);
  if (reviewMatch) {
    const num = parseInt(reviewMatch[1], 10);
    const chars: string[] = [];
    for (const lesson of group.lessons) {
      const n = parseInt(String(lesson.id), 10);
      if (!Number.isFinite(n)) continue;
      if (n > num) break;
      chars.push(...lesson.chars);
    }

    const source = getLesson(groupId, String(num));
    return {
      headerTop: 'Review',
      pool: Array.from(new Set(chars)),
      isChallenge: false,
      lessonLabel: source?.label,
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