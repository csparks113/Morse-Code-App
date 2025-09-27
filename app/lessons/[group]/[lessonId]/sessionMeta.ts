import { getGroupById, getLesson } from '@/data/lessons';
import i18n from '@/i18n';

export type SessionMeta = {
  headerTop: string;
  pool: string[];
  isChallenge: boolean;
  lessonLabel?: string;
  lessonNumber?: number;
};

function formatChars(chars?: string[]): string | null {
  if (!chars || chars.length === 0) return null;
  if (chars.length === 2) {
    return i18n.t('common:lettersPair', { a: chars[0], b: chars[1] });
  }
  return chars.join(', ');
}

function uniqUpper(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const upper = value.toUpperCase();
    if (!seen.has(upper)) {
      seen.add(upper);
      out.push(upper);
    }
  }
  return out;
}

export function buildSessionMeta(
  groupId: string,
  lessonId?: string,
): SessionMeta {
  const group = getGroupById(groupId);

  if (!group || !lessonId) {
    return {
      headerTop: i18n.t('common:lesson', { num: 1 }),
      pool: [],
      isChallenge: false,
    };
  }

  const challengeMatch = /^challenge-(\d+|final)$/i.exec(String(lessonId));
  if (challengeMatch) {
    const token = challengeMatch[1];
    const lessonsArr = group.lessons;
    let boundaryIdx: number;

    if (token === 'final') {
      boundaryIdx = lessonsArr.length - 1;
    } else {
      const challengeIndex = Math.max(1, parseInt(token, 10));
      boundaryIdx = Math.min(lessonsArr.length - 1, challengeIndex * 2);
    }

    const ordered: string[] = [];
    for (let i = 0; i <= boundaryIdx; i += 1) {
      for (const c of lessonsArr[i].chars) {
        const upper = c.toUpperCase();
        if (!ordered.includes(upper)) {
          ordered.push(upper);
        }
      }
    }

    return {
      headerTop: i18n.t('common:challenge'),
      pool: ordered,
      isChallenge: true,
    };
  }

  const reviewMatch = /^(\d+)-review$/.exec(String(lessonId).toLowerCase());
  if (reviewMatch) {
    const num = parseInt(reviewMatch[1], 10);
    const gathered: string[] = [];
    for (const lesson of group.lessons) {
      const lessonNumber = parseInt(String(lesson.id), 10);
      if (!Number.isFinite(lessonNumber) || lessonNumber > num) {
        if (lessonNumber > num) break;
        continue;
      }
      gathered.push(...lesson.chars);
    }

    const baseLabel = i18n.t('common:lesson', { num });
    const headerTop = `${baseLabel} — ${i18n.t('common:review')}`;
    const source = getLesson(groupId, String(num));

    return {
      headerTop,
      pool: uniqUpper(gathered),
      isChallenge: false,
      lessonLabel: source?.label,
      lessonNumber: num,
    };
  }

  const lesson = getLesson(groupId, lessonId);
  const lessonNumber = lesson ? parseInt(String(lesson.id), 10) : undefined;
  const baseLabel = lessonNumber
    ? i18n.t('common:lesson', { num: lessonNumber })
    : i18n.t('common:lesson', { num: 1 });
  const charLabel = formatChars(lesson?.chars ?? []);
  const headerTop = charLabel ? `${baseLabel} — ${charLabel}` : baseLabel;

  return {
    headerTop,
    pool: lesson?.chars ?? [],
    isChallenge: false,
    lessonLabel: lesson?.label,
    lessonNumber,
  };
}
