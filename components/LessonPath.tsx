// components/LessonPath.tsx
// Renders lessons + reviews + challenges in a vertical list.
// Reviews start after Lesson 2; challenges appear after every 2 reviews,
// and a final challenge is appended at the end.
//
// DEV behavior matches the original:
// - DEV_UNLOCK_ALL = true unlocks everything and enables Send regardless of Receive.
// - Status colors still reflect real thresholds (so “Complete” still means scores >= thresholds).
// - DEV_STRICT_UNLOCKING = true enforces “Challenge after its preceding Review”
//   and tighter availability rules.
// -----------------------------------------------------------------------------

import React from 'react';
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, thresholds } from '../theme/lessonTheme';
import { useRouter } from 'expo-router';
import { useProgressStore } from '../store/useProgressStore';
import LessonCard from './LessonCard';
import { LessonCompletion, ChallengeCompletion } from '@/types/progress';
import { useTranslation } from 'react-i18next';

// 🔧 DEV TOGGLES
const DEV_UNLOCK_ALL = true;          // identical semantics to your original file
const DEV_STRICT_UNLOCKING = false;   // turn on when you’re happy
const CHALLENGE_REQUIRES_SEND_TOO = false; // when strict: also require preceding review's base lesson SEND

type Lesson = { id: string; label: string; chars: string[] };
type Props = { groupId: string; lessons: Lesson[] };

// Internal node model (includes "review" for rendering/title/routing)
type Node =
  | {
      kind: 'lesson';
      key: string;
      index: number;
      label: string;     // "Lesson N"
      chars: string[];
      id: string;        // "N"
      lessonNumber: number;
    }
  | {
      kind: 'review';
      key: string;
      index: number;
      label: string;     // "Lesson N — Review"
      chars: string[];   // usually the lesson’s chars
      id: string;        // "N-review"
      lessonNumber: number; // source lesson number
    }
  | {
      kind: 'challenge';
      key: string;
      index: number;
      label: string;       // "Challenge"
      chars: string[];     // cumulative chars learned so far
      id: string;          // "challenge-<k>" | "challenge-final"
      sourceLessonNumber: number; // the latest lesson number at insertion time
    };

export default function LessonPath({ groupId, lessons }: Props) {
  const { t } = useTranslation(['common', 'lessons']);
  // Global progress store (tracks what the user has completed)
  const progress = useProgressStore((s) => s.progress);

  // Insets (safe area padding for notches/home bars)
  const insets = useSafeAreaInsets();

  // Router for navigation between screens
  const router = useRouter();

  // Helper: return numeric progress for a given *lesson id* ("1","2",...)
  const getLessonProgress = React.useCallback(
    (lessonId: string) => {
      const g = progress[groupId] ?? {};
      const p = g[lessonId];
      return {
        receiveScore: p?.receiveScore ?? (p?.receive ? 100 : 0),
        sendScore: p?.sendScore ?? (p?.send ? 100 : 0),
      };
    },
    [groupId, progress],
  );

  const formatChars = React.useCallback(
    (chars: string[]) => {
      if (!chars || chars.length === 0) return '';
      if (chars.length === 2) {
        return t('common:lettersPair', { a: chars[0], b: chars[1] });
      }
      return chars.join(', ');
    },
    [t],
  );

  // Build nodes: lessons + reviews (>=2) + challenges (every 2 reviews) + final challenge
  const derivedNodes: Node[] = React.useMemo(() => {
    const out: Node[] = [];
    let cumulativeChars: string[] = [];
    let reviewCount = 0;
    let lastLessonNum = 0;

    // Normalize lesson numbers and keep lesson lookup by index
    const normalized = lessons.map((l) => {
      const n =
        Number(String(l.id).replace(/[^0-9]/g, '')) ||
        Number(l.label.match(/\d+/)?.[0] || 0);
      return { lessonNumber: n, chars: l.chars, id: l.id, label: l.label };
    });

    normalized.forEach((l) => {
      // LESSON
      out.push({
        kind: 'lesson',
        key: `lesson-${l.id}`,
        index: out.length,
        label: l.label, // e.g., "Lesson 2"
        chars: l.chars,
        id: l.id,       // e.g., "2"
        lessonNumber: l.lessonNumber,
      });

      // Track learned chars
      lastLessonNum = l.lessonNumber;
      cumulativeChars = Array.from(new Set([...cumulativeChars, ...l.chars]));

      // REVIEW — start after Lesson 2
      if (l.lessonNumber >= 2) {
        out.push({
          kind: 'review',
          key: `review-${l.id}`,
          index: out.length,
          label: `Lesson ${l.lessonNumber} — Review`,
          chars: l.chars.slice(),
          id: `${l.lessonNumber}-review`,
          lessonNumber: l.lessonNumber,
        });
        reviewCount += 1;

        // CHALLENGE after every 2 reviews
        if (reviewCount % 2 === 0) {
          const challengeIndex = reviewCount / 2;
          out.push({
            kind: 'challenge',
            key: `challenge-${challengeIndex}`,
            index: out.length,
            label: 'Challenge',
            chars: cumulativeChars.slice(),
            id: `challenge-${challengeIndex}`,
            sourceLessonNumber: l.lessonNumber,
          });
        }
      }
    });

    // Ensure a final challenge at the end of the section
    if (out.length === 0 || out[out.length - 1].kind !== 'challenge') {
      out.push({
        kind: 'challenge',
        key: `challenge-final`,
        index: out.length,
        label: 'Challenge',
        chars: cumulativeChars.slice(),
        id: `challenge-final`,
        sourceLessonNumber: lastLessonNum,
      });
    }

    return out;
  }, [lessons]);

  // Padding at top of the scroll view (depends on screen height)
  const firstPad = React.useMemo(() => {
    const h = Dimensions.get('window').height;
    return Math.max(spacing(1.5), Math.floor(h * 0.04));
  }, []);

  // ScrollView padding (top + bottom safe area spacing)
  const contentStyle = React.useMemo(
    () => ({
      paddingTop: firstPad,
      paddingBottom: insets.bottom + spacing(8),
    }),
    [firstPad, insets.bottom],
  );

  // Compute each node's status:
  // - Uses the underlying lesson’s progress for review/challenge, too.
  // - When DEV_STRICT_UNLOCKING=true, enforce:
  //   * Review unlocks when its base lesson's RECEIVE passed
  //   * Challenge unlocks only if immediately preceded by a Review whose base lesson meets criteria
  const statuses = React.useMemo(() => {
    const out: (LessonCompletion | ChallengeCompletion)[] = [];
    let activeAssigned = false; // only one "active" at a time (unless DEV unlocks)

    const recvOK = (score: number) => score >= thresholds.receive;
    const sendOK = (score: number) => score >= thresholds.send;

    derivedNodes.forEach((n, idx) => {
      // Map node to *base lesson id* to read progress
      const baseLessonId =
        n.kind === 'lesson'
          ? String(n.lessonNumber)
          : n.kind === 'review'
          ? String(n.lessonNumber)
          : String(n.sourceLessonNumber); // challenge ties to latest lesson

      const p = getLessonProgress(baseLessonId);

      // Passed thresholds?
      const hasReceive = recvOK(p.receiveScore);
      const hasSend = sendOK(p.sendScore);

      // Is node "available" (unlocked)?
      let available: boolean;

      if (!DEV_STRICT_UNLOCKING) {
        // Original, more permissive availability:
        available = (() => {
          if (n.kind === 'lesson') {
            // First lesson always available; otherwise require previous lesson receive
            const pos = derivedNodes.findIndex((x) => x.key === n.key);
            // Find previous *lesson* node before this one
            let prevLessonId: string | null = null;
            for (let i = pos - 1; i >= 0; i--) {
              if (derivedNodes[i].kind === 'lesson') {
                prevLessonId = String((derivedNodes[i] as any).lessonNumber);
                break;
              }
            }
            if (!prevLessonId) return true;
            const prevProg = getLessonProgress(prevLessonId);
            return recvOK(prevProg.receiveScore);
          }

          if (n.kind === 'review') {
            // Review becomes available once its source lesson is learned (receive passed)
            return hasReceive;
          }

          // challenge: available after latest lesson's receive
          const lastProg = getLessonProgress(String(n.sourceLessonNumber));
          return recvOK(lastProg.receiveScore);
        })();
      } else {
        // Strict availability:
        if (n.kind === 'lesson') {
          // First lesson unlocked; others require previous LESSON receive
          // Find previous *lesson* node
          let prevLessonNum: number | null = null;
          for (let j = idx - 1; j >= 0; j--) {
            if (derivedNodes[j].kind === 'lesson') {
              prevLessonNum = (derivedNodes[j] as any).lessonNumber;
              break;
            }
          }
          if (prevLessonNum == null) {
            available = true;
          } else {
            const prev = getLessonProgress(String(prevLessonNum));
            available = recvOK(prev.receiveScore);
          }
        } else if (n.kind === 'review') {
          // Review unlocks when its source LESSON receive is passed
          available = hasReceive;
        } else {
          // Challenge unlocks ONLY if the immediately preceding node is a Review,
          // whose base lesson meets criteria (receive + optional send).
          const prev = derivedNodes[idx - 1];
          if (!prev || prev.kind !== 'review') {
            available = false;
          } else {
            const reviewBase = (prev as any).lessonNumber as number;
            const rp = getLessonProgress(String(reviewBase));
            const ok = CHALLENGE_REQUIRES_SEND_TOO
              ? recvOK(rp.receiveScore) && sendOK(rp.sendScore)
              : recvOK(rp.receiveScore);
            available = ok;
          }
        }
      }

      // 🔧 DEV OVERRIDE: force everything to be "available"
      if (DEV_UNLOCK_ALL) available = true;

      // Determine status (visuals)
      let status: LessonCompletion | ChallengeCompletion;
      if (hasReceive && hasSend) {
        status = 'bothComplete';
      } else if (hasReceive) {
        status = 'receiveComplete';
      } else if (DEV_UNLOCK_ALL) {
        status = 'active'; // many can be active in DEV
      } else if (available && !activeAssigned) {
        status = 'active';
        activeAssigned = true;
      } else {
        status = 'locked';
      }

      out.push(status);
    });

    return out;
  }, [derivedNodes, getLessonProgress]);

  return (
    <ScrollView
      contentContainerStyle={contentStyle}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.list}>
        {derivedNodes.map((n, i) => {
          const status = statuses[i];
          const isLesson = n.kind === 'lesson';
          const isReview = n.kind === 'review';
          const isChallenge = n.kind === 'challenge';

          // Progress is always read from the underlying lesson
          const baseLessonId =
            isLesson ? String(n.lessonNumber)
            : isReview ? String(n.lessonNumber)
            : String((n as any).sourceLessonNumber);

          const progressState = getLessonProgress(baseLessonId);

          // Flags
          const receiveDone =
            status === 'receiveComplete' || status === 'bothComplete';
          const sendDone = status === 'bothComplete';

          // ✅ Can user attempt "Send"? matches original:
          // DEV: always true; otherwise require Receive threshold on the base lesson.
          const canSend = DEV_UNLOCK_ALL
            ? true
            : progressState.receiveScore >= thresholds.receive;

          // Locked?
          const locked = status === 'locked';

          // Title + subtitle
          const baseLessonNumber = isChallenge ? (n as any).sourceLessonNumber : (n as any).lessonNumber;

          const title = isChallenge
            ? t('common:challenge')
            : isReview
            ? t('common:lesson', { num: baseLessonNumber }) + ' — ' + t('common:review')
            : t('common:lesson', { num: baseLessonNumber });

          const subtitle = (isLesson || isReview) ? formatChars((n as any).chars) : undefined;

          // Route param per kind
          const lessonIdParam = isChallenge
            ? n.id // "challenge-1", "challenge-final"
            : isReview
            ? `${(n as any).lessonNumber}-review`
            : String((n as any).lessonNumber);

          return (
            <LessonCard
              key={n.key}
              kind={isChallenge ? 'challenge' : isReview ? 'review' : 'lesson'} // reviews render like lessons
              title={title}
              subtitle={subtitle}
              locked={locked}
              receiveDone={receiveDone}
              sendDone={sendDone}
              isActive={status === 'active'}
              canSend={canSend}
              onReceive={() =>
                router.push({
                  pathname: '/lessons/[group]/[lessonId]/receive',
                  params: { group: groupId, lessonId: lessonIdParam },
                })
              }
              onSend={() =>
                router.push({
                  pathname: '/lessons/[group]/[lessonId]/send',
                  params: { group: groupId, lessonId: lessonIdParam },
                })
              }
            />
          );
        })}
      </View>
    </ScrollView>
  );
}

// Formats a list of characters like ["E", "T"] into "E & T"
const styles = StyleSheet.create({
  list: {
    width: '100%',
  },
});











