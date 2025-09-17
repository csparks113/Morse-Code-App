import { getGroupById, getLesson } from '@/data/lessons';

export type SessionMeta = {
  headerTop: string;
  pool: string[];
  isChallenge: boolean;
  lessonLabel?: string;
};

export function buildSessionMeta(groupId: string, lessonId?: string): SessionMeta {
  const group = getGroupById(groupId);
  if (!group || !lessonId) {
    return { headerTop: 'Lesson', pool: [], isChallenge: false };
  }

  if (lessonId.startsWith('ch-')) {
    const idx = Number.parseInt(lessonId.slice(3), 10) || 1;
    const upto = Math.min(group.lessons.length, idx * 2);
    const slice = group.lessons.slice(0, upto);
    const chars = Array.from(new Set(slice.flatMap((l) => l.chars)));
    return {
      headerTop: 'Challenge',
      pool: chars,
      isChallenge: true,
    };
  }

  const lesson = getLesson(groupId, lessonId);
  const label = lesson ? `${lesson.label} - ${lesson.chars.join(' & ')}` : 'Lesson';
  return {
    headerTop: label,
    pool: lesson?.chars ?? [],
    isChallenge: false,
    lessonLabel: lesson?.label,
  };
}