import type { PathNode } from '@/types/session';

export function buildSectionPath(
  sectionId: string,
  lessons: { lessonNumber: number; chars: string[] }[],
): PathNode[] {
  const nodes: PathNode[] = [];
  let reviewCount = 0;

  for (const L of lessons) {
    nodes.push({
      id: `${sectionId}-L${L.lessonNumber}`,
      kind: 'lesson',
      sectionId,
      index: nodes.length,
      title: `Lesson ${L.lessonNumber} — ${L.chars.join(' & ')}`,
      lessonNumber: L.lessonNumber,
      chars: L.chars,
      state: 'locked',
    });

    if (L.lessonNumber >= 2) {
    nodes.push({
        id: `${sectionId}-L${L.lessonNumber}-review`,
        kind: 'review',
        sectionId,
        index: nodes.length,
        title: `Lesson ${L.lessonNumber} — Review`,
        lessonNumber: L.lessonNumber,
        state: 'locked',
    });
    reviewCount++;

    if (reviewCount % 2 === 0) {
        nodes.push({
        id: `${sectionId}-challenge-${reviewCount / 2}`,
        kind: 'challenge',
        sectionId,
        index: nodes.length,
        title: 'Challenge',
        state: 'locked',
        });
    }
    }
  }

  if (!nodes.some(n => n.kind === 'challenge' && n.index === nodes.length - 1)) {
    nodes.push({
      id: `${sectionId}-final-challenge`,
      kind: 'challenge',
      sectionId,
      index: nodes.length,
      title: 'Challenge',
      state: 'locked',
    });
  }
  return nodes;
}
