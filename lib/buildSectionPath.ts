type PathNode = {
  id: string;
  kind: 'lesson' | 'review' | 'challenge';
  sectionId: string;
  index: number;
  title: string;
  state: 'locked' | 'available' | 'completed';
  lessonNumber?: number;
  chars?: string[];
};

export function buildSectionPath(
  sectionId: string,
  lessons: { lessonNumber: number; chars: string[] }[],
): PathNode[] {
  const nodes: PathNode[] = [];
  let reviewCount = 0;

  for (const lesson of lessons) {
    nodes.push({
      id: `${sectionId}-L${lesson.lessonNumber}`,
      kind: 'lesson',
      sectionId,
      index: nodes.length,
      title: `Lesson ${lesson.lessonNumber} - ${lesson.chars.join(' & ')}`,
      lessonNumber: lesson.lessonNumber,
      chars: lesson.chars,
      state: 'locked',
    });

    if (lesson.lessonNumber >= 2) {
      nodes.push({
        id: `${sectionId}-L${lesson.lessonNumber}-review`,
        kind: 'review',
        sectionId,
        index: nodes.length,
        title: `Lesson ${lesson.lessonNumber} - Review`,
        lessonNumber: lesson.lessonNumber,
        state: 'locked',
      });
      reviewCount += 1;

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

  const lastNode = nodes[nodes.length - 1];
  if (!lastNode || lastNode.kind !== 'challenge') {
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
