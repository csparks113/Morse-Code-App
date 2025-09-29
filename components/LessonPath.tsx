// components/LessonPath.tsx
import React from 'react';
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import LessonCard from '@/components/LessonCard';
import { useProgressStore } from '@/store/useProgressStore';
import { colors, spacing, thresholds as themeThresholds } from '@/theme/lessonTheme';

// ---- SAFE FALLBACKS (prevents “unexpected undefined” when a named export is missing)
const thresholds = themeThresholds ?? { receive: 80, send: 80 };

// Small local type to avoid importing from '@/types/progress'
type NodeStatus = 'locked' | 'active' | 'receiveComplete' | 'bothComplete';

// Feature toggles
const DEV_UNLOCK_ALL = false;
// If true, the lesson after a challenge requires the challenge SEND as well.
const CHALLENGE_REQUIRES_SEND_TOO = false;

type Lesson = { id: string; label: string; chars: string[] };
type Props = { groupId: string; lessons: Lesson[] };

type Node =
  | {
      kind: 'lesson';
      key: string;
      index: number;
      label: string;
      chars: string[];
      id: string;
      lessonNumber: number;
    }
  | {
      kind: 'review';
      key: string;
      index: number;
      label: string;
      chars: string[];
      id: string; // "<lessonNumber>-review"
      lessonNumber: number;
    }
  | {
      kind: 'challenge';
      key: string;
      index: number;
      label: string;
      chars: string[];
      id: string; // "challenge-<n>" or "challenge-final"
      sourceLessonNumber: number;
    };

export default function LessonPath({ groupId, lessons }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // ---- progress store
  const progress = useProgressStore((s) => s.progress);
  const groupProgress = React.useMemo(() => progress[groupId] ?? {}, [groupId, progress]);

  const getProgress = React.useCallback(
    (id: string) => {
      const entry = groupProgress[id];
      return {
        receiveScore: entry?.receiveScore ?? (entry?.receive ? 100 : 0),
        sendScore: entry?.sendScore ?? (entry?.send ? 100 : 0),
      };
    },
    [groupProgress],
  );

  const recvOK = (s: number) => s >= thresholds.receive;
  const sendOK = (s: number) => s >= thresholds.send;

  const formatChars = React.useCallback((chars: string[]) => {
    if (!chars?.length) return '';
    if (chars.length === 2) return `${chars[0]} & ${chars[1]}`;
    return chars.join(', ');
  }, []);

  // ---- Build nodes: lessons + reviews + periodic challenges + final challenge
  const derivedNodes: Node[] = React.useMemo(() => {
    const out: Node[] = [];
    let cumulativeChars: string[] = [];
    let reviewCount = 0;
    let lastLessonNum = 0;

    const normalized = lessons.map((l) => {
      const n =
        Number(String(l.id).replace(/[^0-9]/g, '')) ||
        Number(l.label.match(/\d+/)?.[0] || 0);
      return { lessonNumber: n, chars: l.chars, id: l.id, label: l.label };
    });

    normalized.forEach((l) => {
      out.push({
        kind: 'lesson',
        key: `lesson-${l.id}`,
        index: out.length,
        label: l.label,
        chars: l.chars,
        id: l.id,
        lessonNumber: l.lessonNumber,
      });

      lastLessonNum = l.lessonNumber;
      cumulativeChars = Array.from(new Set([...cumulativeChars, ...l.chars]));

      if (l.lessonNumber >= 2) {
        out.push({
          kind: 'review',
          key: `review-${l.id}`,
          index: out.length,
          label: `Lesson ${l.lessonNumber} - Review`,
          chars: l.chars.slice(),
          id: `${l.lessonNumber}-review`,
          lessonNumber: l.lessonNumber,
        });
        reviewCount += 1;

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

  // ---- Per-node progress state
  const nodeStates = React.useMemo(() => {
    return derivedNodes.map((node) => {
      const progressKey =
        node.kind === 'lesson'
          ? String((node as any).lessonNumber)
          : node.kind === 'review'
          ? `${(node as any).lessonNumber}-review`
          : node.id;

      const p = getProgress(progressKey);
      return {
        key: progressKey,
        receiveScore: p.receiveScore,
        sendScore: p.sendScore,
        receiveDone: recvOK(p.receiveScore),
        sendDone: sendOK(p.sendScore),
      };
    });
  }, [derivedNodes, getProgress]);

  // ---- Availability (unlocked), independent of “active”
  const availability = React.useMemo(() => {
    if (DEV_UNLOCK_ALL) return derivedNodes.map(() => true);

    const avail: boolean[] = [];

    for (let i = 0; i < derivedNodes.length; i++) {
      const n = derivedNodes[i];
      let available = false;

      if (n.kind === 'lesson') {
        if (i === 0) {
          available = true; // first lesson always unlocked
        } else {
          const prev = derivedNodes[i - 1];

          if (prev.kind === 'challenge') {
            // Lesson after a Challenge waits for that Challenge
            const cp = getProgress(prev.id);
            available =
              recvOK(cp.receiveScore) &&
              (!CHALLENGE_REQUIRES_SEND_TOO || sendOK(cp.sendScore));
          } else {
            // Otherwise, gate by previous LESSON's receive
            let prevLessonNum: number | null = null;
            for (let j = i - 1; j >= 0; j--) {
              if (derivedNodes[j].kind === 'lesson') {
                prevLessonNum = (derivedNodes[j] as any).lessonNumber;
                break;
              }
            }
            available =
              prevLessonNum == null
                ? true
                : recvOK(getProgress(String(prevLessonNum)).receiveScore);
          }
        }
      } else if (n.kind === 'review') {
        // Review unlocks after its lesson's receive
        const lp = getProgress(String(n.lessonNumber));
        available = recvOK(lp.receiveScore);
      } else {
        // Challenge unlocks after latest lesson's receive
        const lp = getProgress(String(n.sourceLessonNumber));
        available = recvOK(lp.receiveScore);
      }

      avail.push(available);
    }

    return avail;
  }, [derivedNodes, getProgress]);

  // ---- Choose a single "active" among available nodes that haven't passed receive
  const statuses: NodeStatus[] = React.useMemo(() => {
    const out: NodeStatus[] = [];
    let activeAssigned = false;

    for (let i = 0; i < derivedNodes.length; i++) {
      const st = nodeStates[i];
      const available = availability[i];

      let status: NodeStatus;
      if (st.receiveDone && st.sendDone) status = 'bothComplete';
      else if (st.receiveDone) status = 'receiveComplete';
      else if (available && !activeAssigned) {
        status = 'active';
        activeAssigned = true;
      } else {
        status = 'locked';
      }
      out.push(status);
    }
    return out;
  }, [derivedNodes, nodeStates, availability]);

  // ---- Send gating: first available node with receive done & send not done
  const sendActiveFlags = React.useMemo(() => {
    if (DEV_UNLOCK_ALL) return derivedNodes.map(() => true);
    let allPrevSendComplete = true;
    return derivedNodes.map((_, i) => {
      const st = nodeStates[i];
      const canSend =
        allPrevSendComplete && availability[i] && st.receiveDone && !st.sendDone;
      if (!st.sendDone) allPrevSendComplete = false;
      return canSend;
    });
  }, [derivedNodes, nodeStates, availability]);

  // ---- Auto-center to first actionable card (send incomplete, else first active receive)
  const targetIndex = React.useMemo(() => {
    const len = derivedNodes.length;
    let firstSend: number | null = null;
    let firstRecv: number | null = null;
    for (let i = 0; i < len; i++) {
      if (firstSend == null && sendActiveFlags[i]) firstSend = i;
      if (
        firstRecv == null &&
        statuses[i] === 'active' &&
        availability[i] &&
        !nodeStates[i].receiveDone
      ) {
        firstRecv = i;
      }
      if (firstSend != null && firstRecv != null) break;
    }
    return firstSend ?? firstRecv ?? 0;
  }, [derivedNodes, statuses, nodeStates, sendActiveFlags, availability]);

  // ---- scroll-to-center
  const scrollRef = React.useRef<ScrollView | null>(null);
  const scrollContainerH = React.useRef(0);
  const itemLayouts = React.useRef<Array<{ y: number; h: number }>>([]);

  const setItemLayout = React.useCallback(
    (index: number, y: number, h: number) => {
      itemLayouts.current[index] = { y, h };
      if (index === targetIndex) {
        const containerH = scrollContainerH.current || Dimensions.get('window').height;
        const offset = Math.max(y - (containerH - h) / 2, 0);
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ y: offset, animated: true });
        });
      }
    },
    [targetIndex],
  );

  React.useEffect(() => {
    const entry = itemLayouts.current[targetIndex];
    if (!entry) return;
    const containerH = scrollContainerH.current || Dimensions.get('window').height;
    const offset = Math.max(entry.y - (containerH - entry.h) / 2, 0);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: offset, animated: true });
    });
  }, [targetIndex]);

  // ---- padding
  const contentStyle = React.useMemo(
    () => ({
      paddingTop: Math.max(spacing(1.5), Math.floor(Dimensions.get('window').height * 0.04)),
      paddingBottom: insets.bottom + spacing(8),
    }),
    [insets.bottom],
  );

  return (
    <ScrollView
      ref={scrollRef}
      onLayout={(e) => { scrollContainerH.current = e.nativeEvent.layout.height; }}
      contentContainerStyle={contentStyle}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.list}>
        {derivedNodes.map((n, i) => {
          const isReview = n.kind === 'review';
          const isChallenge = n.kind === 'challenge';

          const ns = nodeStates[i];
          const locked = !availability[i];
          const canSend = Boolean(sendActiveFlags[i]);

          const baseLessonNumber = isChallenge
            ? (n as any).sourceLessonNumber
            : (n as any).lessonNumber;

          const title = isChallenge
            ? 'Challenge'
            : isReview
            ? `Lesson ${baseLessonNumber} - Review`
            : `Lesson ${baseLessonNumber}`;

          const subtitle = !isChallenge ? formatChars((n as any).chars) : undefined;

          const lessonIdParam = isChallenge
            ? n.id
            : isReview
            ? `${(n as any).lessonNumber}-review`
            : String((n as any).lessonNumber);

          return (
            <View
              key={n.key}
              onLayout={(e) => setItemLayout(i, e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
            >
              <LessonCard
                kind={isChallenge ? 'challenge' : isReview ? 'review' : 'lesson'}
                title={title}
                subtitle={subtitle}
                locked={locked}
                receiveDone={ns.receiveDone}
                sendDone={ns.sendDone}
                isActive={statuses[i] === 'active'}
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
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { width: '100%' },
});
