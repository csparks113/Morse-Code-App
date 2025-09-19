// LessonPath
// Renders lesson and challenge cards in a scrollable list.
import React from 'react';
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, thresholds } from '../theme/lessonTheme';
import { useRouter } from 'expo-router';
import { useProgressStore } from '../store/useProgressStore';
import LessonCard from './LessonCard';
import { LessonCompletion, ChallengeCompletion } from '@/types/progress';

type Lesson = { id: string; label: string; chars: string[] };
type Props = { groupId: string; lessons: Lesson[] };

export default function LessonPath({ groupId, lessons }: Props) {
  const progress = useProgressStore((s) => s.progress);
  const insets = useSafeAreaInsets();
  const router = useRouter();

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

  const derivedNodes: Node[] = React.useMemo(() => {
    const out: Node[] = [];
    let cumulativeChars: string[] = [];
    lessons.forEach((l, i) => {
      out.push({
        kind: 'lesson',
        key: `l-${l.id}`,
        index: out.length,
        label: l.label,
        chars: l.chars,
        id: l.id,
      });
      cumulativeChars = Array.from(new Set([...cumulativeChars, ...l.chars]));
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

  const firstPad = React.useMemo(() => {
    const h = Dimensions.get('window').height;
    return Math.max(spacing(1.5), Math.floor(h * 0.04));
  }, []);

  const contentStyle = React.useMemo(
    () => ({
      paddingTop: firstPad,
      paddingBottom: insets.bottom + spacing(8),
    }),
    [firstPad, insets.bottom],
  );

  const statuses = React.useMemo(() => {
    const out: (LessonCompletion | ChallengeCompletion)[] = [];
    let activeAssigned = false;
    derivedNodes.forEach((n) => {
      const p = getLessonProgress(n.id);
      const receive = p.receiveScore >= thresholds.receive;
      const send = p.sendScore >= thresholds.send;
      const available = (() => {
        if (n.kind === 'lesson') {
          const pos = lessons.findIndex((lesson) => lesson.id === n.id);
          if (pos <= 0) return true;
          const prevId = lessons[pos - 1].id;
          return getLessonProgress(prevId).receiveScore >= thresholds.receive;
        }
        const idx = parseInt(String(n.id).replace('ch-', ''), 10);
        const prevIdx = Math.min(idx * 2 - 1, lessons.length - 1);
        if (prevIdx < 0) return false;
        const prevId = lessons[prevIdx].id;
        return getLessonProgress(prevId).receiveScore >= thresholds.receive;
      })();
      let status: LessonCompletion | ChallengeCompletion;
      if (receive && send) status = 'bothComplete';
      else if (receive) status = 'receiveComplete';
      else if (available && !activeAssigned) {
        status = 'active';
        activeAssigned = true;
      } else status = 'locked';
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
          const receiveDone =
            status === 'receiveComplete' || status === 'bothComplete';
          const sendDone = status === 'bothComplete';
          const canSend = progressState.receiveScore >= thresholds.receive;
          const locked = status === 'locked';

          return (
            <LessonCard
              key={n.key}
              kind={n.kind}
              title={isLesson ? n.label : 'Challenge'}
              subtitle={isLesson ? formatChars(n.chars) : undefined}
              locked={locked}
              receiveDone={receiveDone}
              sendDone={sendDone}
              isActive={status === 'active'}
              canSend={canSend}
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

function formatChars(chars: string[]) {
  return chars.join(' & ');
}

const styles = StyleSheet.create({
  list: {
    width: '100%',
  },
});
