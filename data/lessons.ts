// data/lessons.ts
// ----------------
// This file defines lesson GROUPS and per-lesson content. Each lesson has:
// - id: string (stable identifier)
// - label: e.g. "Lesson 1"
// - chars: array of characters learned in this lesson
//
// NOTE: We start with the "Alphabet" group and seed a few lessons to illustrate
// the structure. You can expand this list at any time; the UI will reflect it.

export type Lesson = {
  id: string;
  label: string;
  chars: string[]; // e.g., ["E", "T"]
};

export type LessonGroup = {
  id: string; // used in routes (e.g., "alphabet")
  title: string; // displayed in the header
  lessons: Lesson[];
};

// A small starter curriculum. You can add more (A/N, I/M, S/O, etc.)
// following the same pattern, and add a "numbers" group as well.
export const LESSON_GROUPS: LessonGroup[] = [
  {
    id: 'alphabet',
    title: 'Alphabet',
    lessons: [
      { id: '1', label: 'Lesson 1', chars: ['E', 'T'] }, // basic single tones
      { id: '2', label: 'Lesson 2', chars: ['A', 'N'] },
      { id: '3', label: 'Lesson 3', chars: ['I', 'M'] },
      { id: '4', label: 'Lesson 4', chars: ['S', 'O'] },
      { id: '5', label: 'Lesson 5', chars: ['H', 'K'] },
      { id: '6', label: 'Lesson 6', chars: ['R', 'U'] },
      { id: '7', label: 'Lesson 7', chars: ['W', 'G'] },
      { id: '8', label: 'Lesson 8', chars: ['L', 'F'] },
      { id: '9', label: 'Lesson 9', chars: ['P', 'J'] },
      { id: '10', label: 'Lesson 10', chars: ['B', 'D'] },
      { id: '11', label: 'Lesson 11', chars: ['C', 'Y'] },
      { id: '12', label: 'Lesson 12', chars: ['Q', 'X'] },
      { id: '13', label: 'Lesson 13', chars: ['V', 'Z'] },
    ],
  },
  {
    id: 'numbers',
    title: 'Numbers',
    lessons: [
      { id: '1', label: 'Lesson 1', chars: ['1', '2'] },
      { id: '2', label: 'Lesson 2', chars: ['3', '4'] },
      { id: '3', label: 'Lesson 3', chars: ['5', '6'] },
      { id: '4', label: 'Lesson 4', chars: ['7', '8'] },
      { id: '5', label: 'Lesson 5', chars: ['9', '0'] },
    ],
  },
];

// Helper to get a group by id
export function getGroupById(groupId: string): LessonGroup | undefined {
  return LESSON_GROUPS.find((g) => g.id === groupId);
}

// Helper to get lesson by group + lessonId
export function getLesson(
  groupId: string,
  lessonId: string,
): Lesson | undefined {
  const group = getGroupById(groupId);
  return group?.lessons.find((l) => l.id === lessonId);
}
