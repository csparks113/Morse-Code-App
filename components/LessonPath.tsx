// LessonPath
// Renders lesson and challenge cards in a vertical scrollable list (the "path").
// -----------------------------------------------------------------------------
// DEV NOTE:
//   Flip the DEV_UNLOCK_ALL flag below to `true` to unlock all lessons/challenges
//   and allow "Send" attempts without first passing "Receive". This never writes
//   to the user's progress—it only affects what's locked/active in the UI.
// -----------------------------------------------------------------------------

import React from 'react';
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, thresholds } from '../theme/lessonTheme';
import { useRouter } from 'expo-router';
import { useProgressStore } from '../store/useProgressStore';
import LessonCard from './LessonCard';
import { LessonCompletion, ChallengeCompletion } from '@/types/progress';

// 🔧 DEV TOGGLE — set to true to unlock everything in the UI
const DEV_UNLOCK_ALL = true;

type Lesson = { id: string; label: string; chars: string[] };
type Props = { groupId: string; lessons: Lesson[] };

export default function LessonPath({ groupId, lessons }: Props) {
  // Global progress store (tracks what the user has completed)
  const progress = useProgressStore((s) => s.progress);

  // Insets (safe area padding for notches/home bars)
  const insets = useSafeAreaInsets();

  // Router for navigation between screens
  const router = useRouter();

  // Helper: gets a lesson's progress (receive & send scores, defaulting to 0/100 if flags exist)
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

  // Node type = either a "lesson" node or a "challenge" node
  type Node =
    | {
        kind: 'lesson';
        key: string;
        index: number;
        label: string;
        chars: string[];
        id: string;
      }
    | {
        kind: 'challenge';
        key: string;
        index: number;
        label: string;
        chars: string[];
        id: string;
      };

  // Build a list of lessons + challenges in order.
  // - A challenge is added after every 2 lessons.
  // - Each challenge uses all characters learned up to that point.
  const derivedNodes: Node[] = React.useMemo(() => {
    const out: Node[] = [];
    let cumulativeChars: string[] = [];

    lessons.forEach((l, i) => {
      // Add lesson
      out.push({
        kind: 'lesson',
        key: `l-${l.id}`,
        index: out.length,
        label: l.label,
        chars: l.chars,
        id: l.id,
      });

      // Track all chars learned so far
      cumulativeChars = Array.from(new Set([...cumulativeChars, ...l.chars]));

      // After every 2 lessons, add a challenge
      if (i % 2 === 1) {
        const chId = `ch-${Math.ceil((i + 1) / 2)}`;
        out.push({
          kind: 'challenge',
          key: chId,
          index: out.length,
          label: 'Challenge',
          chars: cumulativeChars,
          id: chId,
        });
      }
    });

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

  // Compute each lesson/challenge's "status":
  // - 'locked', 'active', 'receiveComplete', or 'bothComplete'
  const statuses = React.useMemo(() => {
    const out: (LessonCompletion | ChallengeCompletion)[] = [];
    let activeAssigned = false; // only one "active" at a time (unless DEV unlocks)

    derivedNodes.forEach((n) => {
      const p = getLessonProgress(n.id);

      // Has user passed receive/send thresholds?
      // (Thresholds still determine "Complete" states—even in dev unlock mode.)
      const receive = p.receiveScore >= thresholds.receive;
      const send = p.sendScore >= thresholds.send;

      // Is this lesson/challenge unlocked (available)?
      let available = (() => {
        if (n.kind === 'lesson') {
          const pos = lessons.findIndex((lesson) => lesson.id === n.id);
          if (pos <= 0) return true; // first lesson is always available

          const prevId = lessons[pos - 1].id;
          return getLessonProgress(prevId).receiveScore >= thresholds.receive;
        }

        // For challenges: unlocked after passing previous lesson’s receive
        const idx = parseInt(String(n.id).replace('ch-', ''), 10);
        const prevIdx = Math.min(idx * 2 - 1, lessons.length - 1);
        if (prevIdx < 0) return false;
        const prevId = lessons[prevIdx].id;
        return getLessonProgress(prevId).receiveScore >= thresholds.receive;
      })();

      // 🔧 DEV OVERRIDE: force everything to be "available"
      if (DEV_UNLOCK_ALL) available = true; // <-- unlock line

      // Determine status
      let status: LessonCompletion | ChallengeCompletion;
      if (receive && send) {
        status = 'bothComplete';
      } else if (receive) {
        status = 'receiveComplete';
      } else if (DEV_UNLOCK_ALL) {
        // 🔧 DEV OVERRIDE: mark all not-yet-complete items as 'active'
        // (so none appear locked while testing)
        status = 'active';
        // NOTE: we intentionally do NOT flip activeAssigned here so multiple can appear active.
      } else if (available && !activeAssigned) {
        status = 'active';
        activeAssigned = true;
      } else {
        status = 'locked';
      }

      out.push(status);
    });

    return out;
  }, [derivedNodes, lessons, getLessonProgress]);

  return (
    <ScrollView
      contentContainerStyle={contentStyle}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.list}>
        {derivedNodes.map((n, i) => {
          const status = statuses[i];
          const isLesson = n.kind === 'lesson';

          const progressState = getLessonProgress(n.id);

          // Flags for what’s done
          const receiveDone =
            status === 'receiveComplete' || status === 'bothComplete';
          const sendDone = status === 'bothComplete';

          // Can user attempt "send" yet? (only after passing receive)
          // 🔧 DEV OVERRIDE: allow "Send" even if receive not passed
          const canSend = DEV_UNLOCK_ALL
            ? true
            : progressState.receiveScore >= thresholds.receive;

          // Is the node locked?
          const locked = status === 'locked';

          return (
            <LessonCard
              key={n.key}
              kind={n.kind}
              title={isLesson ? n.label : 'Challenge'}
              subtitle={isLesson ? formatChars(n.chars) : undefined}
              locked={locked}                   // 🔒 Lock visual
              receiveDone={receiveDone}         // ✅ Receive finished?
              sendDone={sendDone}               // ✅ Send finished?
              isActive={status === 'active'}    // ✨ Highlight as active
              canSend={canSend}                 // ✉️  Enable send button?
              onReceive={() =>
                router.push({
                  pathname: '/lessons/[group]/[lessonId]/receive',
                  params: { group: groupId, lessonId: String(n.id) },
                })
              }
              onSend={() =>
                router.push({
                  pathname: '/lessons/[group]/[lessonId]/send',
                  params: { group: groupId, lessonId: String(n.id) },
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
function formatChars(chars: string[]) {
  return chars.join(' & ');
}

const styles = StyleSheet.create({
  list: {
    width: '100%',
  },
});
