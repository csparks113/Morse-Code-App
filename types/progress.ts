// app/types/progress.ts

export type LessonMode = 'receive' | 'send';
export type LessonCompletion =
  | 'locked'
  | 'active'
  | 'receiveComplete'
  | 'bothComplete';

export type ChallengeCompletion =
  | 'locked'
  | 'active'
  | 'receiveComplete' // silver star
  | 'bothComplete'; // gold crown

export interface LessonNodeData {
  id: string;
  title: string; // "Lesson 1"
  subtitle?: string; // "E & T" or "1 & 2"
  morse: string[]; // e.g., ['.-', '-.'] or digit codes
  completion: LessonCompletion;
}

export interface ChallengeNodeData {
  id: string;
  title: string; // "Challenge"
  completion: ChallengeCompletion;
}

