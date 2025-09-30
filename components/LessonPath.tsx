// components/LessonPath.tsx
import React from 'react';
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import LessonCard from '@/components/LessonCard';
import { useProgressStore } from '@/store/useProgressStore';
import { spacing, thresholds as themeThresholds } from '@/theme/lessonTheme';

// Safe fallback so a missing named export doesn't crash Metro
const thresholds = themeThresholds ?? { receive: 80, send: 80 };

// Feature toggles
const DEV_UNLOCK_ALL = false;
const CHALLENGE_REQUIRES_SEND_TOO = false; // if true, next lesson waits for challenge SEND too

type Lesson = { id: string; label: string; chars: string[] };
type Props = { groupId: string; lessons: Lesson[] };

type Node =
  | { kind: 'lesson'; key: string; index: number; label: string; chars: string[]; id: string; lessonNumber: number }
  | { kind: 'review'; key: string; index: number; label: string; chars: string[]; id: string; lessonNumber: number }
  | { kind: 'challenge'; key: string; index: number; label: string; chars: string[]; id: string; sourceLessonNumber: number };

type NodeStatus = 'locked' | 'active' | 'receiveComplete' | 'bothComplete';

export default function LessonPath({ groupId, lessons }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // progress store
  const progress = useProgressStore((s) => s.progress);
  const groupProgress = React.useMemo(() => progress[groupId] ?? {}, [groupId, progress]);

  const recvOK = (s: number) => s >= thresholds.receive;
  const sendOK = (s: number) => s >= thresholds.send;

  // STICKY completion pull
  const getEntry = React.useCallback((id: string) => {
    const e: any = groupProgress[id] ?? {};
    const rScores = [e.bestReceiveScore, e.maxReceiveScore, e.receiveScore].filter((n) => typeof n === 'number');
    const sScores = [e.bestSendScore, e.maxSendScore, e.sendScore].filter((n) => typeof n === 'number');
    const receiveScore = rScores.length ? Math.max(...rScores) : (e.receive ? thresholds.receive : 0);
    const sendScore = sScores.length ? Math.max(...sScores) : (e.send ? thresholds.send : 0);
    const receiveDone = e.receive === true || e.receiveDone === true || recvOK(receiveScore);
    const sendDone = e.send === true || e.sendDone === true || sendOK(sendScore);
    return { receiveScore, sendScore, receiveDone, sendDone };
  }, [groupProgress]);

  const formatChars = React.useCallback((chars: string[]) => {
    if (!chars?.length) return '';
    if (chars.length === 2) return `${chars[0]} & ${chars[1]}`;
    return chars.join(', ');
  }, []);

  // Build nodes
  const derivedNodes: Node[] = React.useMemo(() => {
    const out: Node[] = [];
    let cumulativeChars: string[] = [];
    let reviewCount = 0;
    let lastLessonNum = 0;

    const normalized = lessons.map((l) => {
      const n = Number(String(l.id).replace(/[^0-9]/g, '')) || Number(l.label.match(/\d+/)?.[0] || 0);
      return { lessonNumber: n, chars: l.chars, id: l.id, label: l.label };
    });

    normalized.forEach((l) => {
      out.push({ kind: 'lesson', key: `lesson-${l.id}`, index: out.length, label: l.label, chars: l.chars, id: l.id, lessonNumber: l.lessonNumber });

      lastLessonNum = l.lessonNumber;
      cumulativeChars = Array.from(new Set([...cumulativeChars, ...l.chars]));

      if (l.lessonNumber >= 2) {
        out.push({ kind: 'review', key: `review-${l.id}`, index: out.length, label: `Lesson ${l.lessonNumber} - Review`, chars: l.chars.slice(), id: `${l.lessonNumber}-review`, lessonNumber: l.lessonNumber });
        reviewCount += 1;

        if (reviewCount % 2 === 0) {
          const challengeIndex = reviewCount / 2;
          out.push({ kind: 'challenge', key: `challenge-${challengeIndex}`, index: out.length, label: 'Challenge', chars: cumulativeChars.slice(), id: `challenge-${challengeIndex}`, sourceLessonNumber: l.lessonNumber });
        }
      }
    });

    if (out.length === 0 || out[out.length - 1].kind !== 'challenge') {
      out.push({ kind: 'challenge', key: `challenge-final`, index: out.length, label: 'Challenge', chars: cumulativeChars.slice(), id: `challenge-final`, sourceLessonNumber: lastLessonNum });
    }
    return out;
  }, [lessons]);

  // Per-node sticky state
  const nodeStates = React.useMemo(() => {
    return derivedNodes.map((node) => {
      const key =
        node.kind === 'lesson' ? String((node as any).lessonNumber)
        : node.kind === 'review' ? `${(node as any).lessonNumber}-review`
        : node.id;
      const p = getEntry(key);
      return { key, receiveDone: p.receiveDone, sendDone: p.sendDone };
    });
  }, [derivedNodes, getEntry]);

  // Availability (gating)
  const availability = React.useMemo(() => {
    if (DEV_UNLOCK_ALL) return derivedNodes.map(() => true);
    const avail: boolean[] = [];

    for (let i = 0; i < derivedNodes.length; i++) {
      const n = derivedNodes[i];
      let available = false;

      if (n.kind === 'lesson') {
        if (i === 0) {
          available = true;
        } else {
          const prev = derivedNodes[i - 1];
          if (prev.kind === 'challenge') {
            const cp = getEntry(prev.id);
            available = cp.receiveDone && (!CHALLENGE_REQUIRES_SEND_TOO || cp.sendDone);
          } else if (prev.kind === 'review') {
            const rp = getEntry(prev.id);
            available = rp.receiveDone; // waits for the review
          } else {
            // fallback: previous lesson's receive
            let prevLessonNum: number | null = null;
            for (let j = i - 1; j >= 0; j--) if (derivedNodes[j].kind === 'lesson') { prevLessonNum = (derivedNodes[j] as any).lessonNumber; break; }
            available = prevLessonNum == null ? true : getEntry(String(prevLessonNum)).receiveDone;
          }
        }
      } else if (n.kind === 'review') {
        available = getEntry(String(n.lessonNumber)).receiveDone;
      } else {
        available = getEntry(String(n.sourceLessonNumber)).receiveDone;
      }

      avail.push(available);
    }
    return avail;
  }, [derivedNodes, getEntry]);

  // Statuses (single active)
  const statuses: NodeStatus[] = React.useMemo(() => {
    const out: NodeStatus[] = [];
    let activeAssigned = false;
    for (let i = 0; i < derivedNodes.length; i++) {
      const st = nodeStates[i];
      const available = availability[i];
      let status: NodeStatus;
      if (st.receiveDone && st.sendDone) status = 'bothComplete';
      else if (st.receiveDone) status = 'receiveComplete';
      else if (available && !activeAssigned) { status = 'active'; activeAssigned = true; }
      else status = 'locked';
      out.push(status);
    }
    return out;
  }, [derivedNodes, nodeStates, availability]);

  // Send gating (first eligible)
  const sendActiveFlags = React.useMemo(() => {
    if (DEV_UNLOCK_ALL) return derivedNodes.map(() => true);
    let allPrevSendComplete = true;
    return derivedNodes.map((_, i) => {
      const st = nodeStates[i];
      const canSend = allPrevSendComplete && availability[i] && st.receiveDone && !st.sendDone;
      if (!st.sendDone) allPrevSendComplete = false;
      return canSend;
    });
  }, [derivedNodes, nodeStates, availability]);

  // ---- Autoscroll centering fix ----
  // The content has top padding; include it in offset and clamp to range.
  const firstPad = React.useMemo(() => {
    const h = Dimensions.get('window').height;
    return Math.max(spacing(1.5), Math.floor(h * 0.04));
  }, []);
  const contentStyle = React.useMemo(
    () => ({ paddingTop: firstPad, paddingBottom: insets.bottom + spacing(8) }),
    [firstPad, insets.bottom]
  );

  const scrollRef = React.useRef<ScrollView | null>(null);
  const scrollContainerH = React.useRef(0);
  const contentH = React.useRef(0);
  const itemLayouts = React.useRef<Array<{ y: number; h: number }>>([]);

  const computeAndScroll = React.useCallback((index: number) => {
    const entry = itemLayouts.current[index];
    if (!entry) return;
    const { y, h } = entry;

    const containerH = scrollContainerH.current || Dimensions.get('window').height;
    const maxScroll = Math.max(contentH.current - containerH, 0);

    // IMPORTANT: y is relative to the list View, which sits below content padding.
    // So add the top padding back in to get the absolute content offset.
    const offsetRaw = (firstPad + y) - (containerH - h) / 2;
    const offset = Math.max(0, Math.min(offsetRaw, maxScroll));

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: offset, animated: true });
    });
  }, [firstPad]);

  const setItemLayout = React.useCallback((index: number, y: number, h: number) => {
    itemLayouts.current[index] = { y, h };
  }, []);

  const targetIndex = React.useMemo(() => {
    const len = derivedNodes.length;
    let firstSend: number | null = null;
    let firstRecv: number | null = null;
    for (let i = 0; i < len; i++) {
      if (firstSend == null && sendActiveFlags[i]) firstSend = i;
      if (firstRecv == null && statuses[i] === 'active' && availability[i] && !nodeStates[i].receiveDone) firstRecv = i;
      if (firstSend != null && firstRecv != null) break;
    }
    return firstSend ?? firstRecv ?? 0;
  }, [derivedNodes, statuses, nodeStates, sendActiveFlags, availability]);

  // Re-center whenever:
  // - target changes
  // - items/layout measured
  // - container size changes
  // - content size changes
  React.useEffect(() => { computeAndScroll(targetIndex); }, [targetIndex, computeAndScroll]);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => computeAndScroll(targetIndex));
    return () => cancelAnimationFrame(id);
  }, [firstPad, computeAndScroll, targetIndex]);

  return (
    <ScrollView
      ref={scrollRef}
      onLayout={(e) => { scrollContainerH.current = e.nativeEvent.layout.height; computeAndScroll(targetIndex); }}
      onContentSizeChange={(w, h) => { contentH.current = h + firstPad; computeAndScroll(targetIndex); }}
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

          const baseLessonNumber = isChallenge ? (n as any).sourceLessonNumber : (n as any).lessonNumber;
          const title = isChallenge ? 'Challenge' : isReview ? `Lesson ${baseLessonNumber} - Review` : `Lesson ${baseLessonNumber}`;
          const subtitle = !isChallenge ? formatChars((n as any).chars) : undefined;

          const lessonIdParam = isChallenge ? n.id : isReview ? `${(n as any).lessonNumber}-review` : String((n as any).lessonNumber);

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
                onReceive={() => router.push({ pathname: '/lessons/[group]/[lessonId]/receive', params: { group: groupId, lessonId: lessonIdParam } })}
                onSend={() => router.push({ pathname: '/lessons/[group]/[lessonId]/send', params: { group: groupId, lessonId: lessonIdParam } })}
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
