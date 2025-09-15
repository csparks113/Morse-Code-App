// LessonPath
// Pill lesson/challenge nodes with receive/send halves and vertical connectors.
import React from 'react';
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, thresholds } from '../theme/lessonTheme';
import { useRouter } from 'expo-router';
import { useProgressStore } from '../store/useProgressStore';
import PillLessonNode from './PillLessonNode';
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
    | { kind: 'lesson'; key: string; index: number; label: string; chars: string[]; id: string }
    | { kind: 'challenge'; key: string; index: number; label: string; chars: string[]; id: string };

  const derivedNodes: Node[] = React.useMemo(() => {
    const out: Node[] = [];
    let cumulativeChars: string[] = [];
    lessons.forEach((l, i) => {
      out.push({ kind: 'lesson', key: `l-${l.id}`, index: out.length, label: l.label, chars: l.chars, id: l.id });
      cumulativeChars = Array.from(new Set([...cumulativeChars, ...l.chars]));
      if (i % 2 === 1) {
        const chId = `ch-${Math.ceil((i + 1) / 2)}`;
        out.push({ kind: 'challenge', key: chId, index: out.length, label: 'Challenge', chars: cumulativeChars, id: chId });
      }
    });
    return out;
  }, [lessons]);

  const firstPad = React.useMemo(() => {
    const h = Dimensions.get('window').height;
    return Math.max(spacing(1.5), Math.floor(h * 0.04));
  }, []);

  const contentStyle = React.useMemo(
    () => ({ paddingTop: spacing(2), paddingBottom: insets.bottom + spacing(10) }),
    [insets.bottom],
  );

  const statuses = React.useMemo(() => {
    const out: (LessonCompletion | ChallengeCompletion)[] = [];
    let activeAssigned = false;
    derivedNodes.forEach((n) => {
      const p = getLessonProgress(n.id);
      const receive = p.receiveScore >= thresholds.receive;
      const send = p.sendScore >= thresholds.send;
      const both = receive && send;
      const available = (() => {
        if (n.kind === 'lesson') {
          const pos = lessons.findIndex((l) => l.id === n.id);
          if (pos <= 0) return true;
          const prevId = lessons[pos - 1].id;
          return getLessonProgress(prevId).receiveScore >= thresholds.receive;
        } else {
          const nStr = String(n.id).replace('ch-', '');
          const idx = parseInt(nStr, 10);
          const prevIdx = Math.min(idx * 2 - 1, lessons.length - 1);
          if (prevIdx < 0) return false;
          const prevId = lessons[prevIdx].id;
          return getLessonProgress(prevId).receiveScore >= thresholds.receive;
        }
      })();
      let status: LessonCompletion | ChallengeCompletion;
      if (both) status = 'bothComplete';
      else if (receive) status = 'receiveComplete';
      else if (available && !activeAssigned) { status = 'active'; activeAssigned = true; }
      else status = 'locked';
      out.push(status);
    });
    return out;
  }, [derivedNodes, lessons, getLessonProgress]);

  return (
    <ScrollView contentContainerStyle={contentStyle}>
      <View style={styles.col}>
        <View style={{ height: firstPad }} />
        {derivedNodes.map((n, i) => {
          const status = statuses[i];
          const isLesson = n.kind === 'lesson';
          return (
            <View key={n.key} style={{ marginBottom: 0 }}>
              <View style={{ alignItems: 'center' }}>
                <PillLessonNode
                  title={isLesson ? n.label : 'Challenge'}
                  subtitle={isLesson ? formatChars(n.chars) : undefined}
                  locked={status === 'locked'}
                  receiveDone={status === 'receiveComplete' || status === 'bothComplete'}
                  sendDone={status === 'bothComplete'}
                  isActive={status === 'active'}
                  canSend={getLessonProgress(n.id).receiveScore >= thresholds.receive}
                  onReceive={() => router.push({ pathname: '/lessons/[group]/[lessonId]/receive', params: { group: groupId, lessonId: String(n.id) } })}
                  onSend={() => router.push({ pathname: '/lessons/[group]/[lessonId]/send', params: { group: groupId, lessonId: String(n.id) } })}
                />
              </View>
              {i < derivedNodes.length - 1 && (
                <Segment
                  {...(() => {
                    const next = statuses[i + 1];
                    const on = next === 'active' || next === 'receiveComplete' || next === 'bothComplete';
                    return on ? { color: colors.border, glow: true } : { color: '#2A2F36', glow: false };
                  })()}
                />
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  col: { width: '100%', paddingHorizontal: spacing(4) },
  segmentWrap: { alignSelf: 'center', height: spacing(6), justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing(0.5) },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dash: { width: 6, height: 18, borderRadius: 3 },
});

function formatChars(chars: string[]) { return chars.join(' & '); }

// Vertical dot–dash–dot–dash connector segment
function Segment({ color, glow = false }: { color: string; glow?: boolean }) {
  const fill = color;
  return (
    <View style={[styles.segmentWrap, (glow ? { shadowColor: color as any, shadowOpacity: 0.8, shadowRadius: 8 } : null) as any]}>
      <View style={[styles.dot, { backgroundColor: fill, width: 6, height: 6, borderRadius: 3, marginVertical: 2 }]} />
      <View style={[styles.dash, { backgroundColor: fill, width: 5, height: 14, borderRadius: 2.5, marginVertical: 2 }]} />
      <View style={[styles.dot, { backgroundColor: fill, width: 6, height: 6, borderRadius: 3, marginVertical: 2 }]} />
      <View style={[styles.dash, { backgroundColor: fill, width: 5, height: 14, borderRadius: 2.5, marginVertical: 2 }]} />
    </View>
  );
}

