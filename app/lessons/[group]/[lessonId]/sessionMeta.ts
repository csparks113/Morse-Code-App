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

  // --- CHALLENGE PATH -------------------------------------------------------
  // Accepts: "challenge-1", "challenge-2", ..., "challenge-final"
  if (/^challenge/.test(lid)) {
    const m = lid.match(/^challenge-(\d+)$/);
    const isFinal = lid === 'challenge-final';
    const k = m ? Math.max(1, parseInt(m[1], 10)) : NaN;
    const limit = isFinal
      ? Number.POSITIVE_INFINITY
      : (Number.isFinite(k) ? k * 2 : Number.POSITIVE_INFINITY);

    const chars: string[] = [];
    let counted = 0;
    for (const lesson of group.lessons) {
      const n = parseInt(String(lesson.id), 10);
      if (!Number.isFinite(n)) continue;
      chars.push(...lesson.chars);
      counted += 1;
      if (counted >= limit) break;
    }

    return {
      headerTop: 'Challenge',
      pool: Array.from(new Set(chars)),
      isChallenge: true,
    };
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