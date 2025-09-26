
// types/session.ts
export type NodeKind = 'lesson' | 'review' | 'challenge';

export interface PathNode {
  id: string;                  // unique route id
  kind: NodeKind;
  sectionId: string;           // e.g., 'alphabet'
  index: number;               // display order within section
  title: string;               // 'Lesson 3 — I & M' | 'Lesson 3 — Review' | 'Challenge'
  lessonNumber?: number;       // present for lesson/review
  chars?: string[];            // for lessons (e.g., ['I', 'M'])
  state: 'locked' | 'active' | 'completed' | 'mastered';
}
