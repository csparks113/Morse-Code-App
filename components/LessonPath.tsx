// LessonPath
// ----------
// Renders the vertical dotted path of lessons:
//  - Each node sits on the center line
//  - A small dotted segment connects nodes (but never above the first)
//  - Tapping a node reveals a prompt card under it
// The component is pure layout/interaction; progression state comes from the store.
import React from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, thresholds } from '../theme/lessonTheme';
// Card that appears under a node with actions (Receive/Send)
import LessonPromptCard from './LessonPromptCard';
import { useProgressStore } from '../store/useProgressStore';
import CoinLessonNode from './LessonNode';
import CoinChallengeNode from './ChallengeNode';
import { LessonCompletion, ChallengeCompletion } from '@/types/progress';
import { toMorse } from '../utils/morse';

type Lesson = { id: string; label: string; chars: string[] };

type Props = {
  groupId: string;
  lessons: Lesson[];
};

// The path is purely presentational: it computes availability only for layout.
export default function LessonPath({ groupId, lessons }: Props) {
  const progress = useProgressStore((s) => s.progress);
  const insets = useSafeAreaInsets();
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

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

  // Build a derived sequence that inserts a Challenge node after every 2 lessons.
  // Challenge N reviews all characters learned so far (cumulative recap).
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

  // Small top spacer to position the first node higher on screen
  const firstPad = React.useMemo(() => {
    const h = Dimensions.get('window').height;
    // Move lesson 1 higher (smaller spacer)
    return Math.max(spacing(1.5), Math.floor(h * 0.04));
  }, []);

  // Keep the last node clear of the tab bar without creating a large empty band
  const contentStyle = React.useMemo(
    () => ({
      paddingTop: spacing(2),
      // Keep last node clear of the tab bar; include base tab height
      paddingBottom: insets.bottom + spacing(10),
    }),
    [insets.bottom],
  );

  // Precompute completion categories and assign a single active node
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
      else if (available && !activeAssigned) {
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
    <ScrollView contentContainerStyle={contentStyle}>
      <View style={styles.col}>
        {openIndex !== null && (
          <Pressable style={styles.overlay} onPress={() => setOpenIndex(null)} />
        )}
        <View style={{ height: firstPad }} />
        {derivedNodes.map((n, i) => {
          const status = statuses[i];
          const isLesson = n.kind === 'lesson';
          const morseLines = isLesson ? n.chars.map((c) => toMorse(c) ?? '') : [];
          return (
            <View key={n.key} style={{ marginBottom: 0 }}>
              {/* Node */}
              <View style={{ alignItems: 'center' }}>
                <Pressable
                  onPress={() => setOpenIndex((cur) => (cur === i ? null : i))}
                  accessibilityRole="button"
                  accessibilityLabel={`${isLesson ? 'Lesson' : 'Challenge'} - ${n.label}`}
                >
                  {isLesson ? (
                    <CoinLessonNode
                      data={{
                        id: String(n.id),
                        title: n.label,
                        subtitle: isLesson ? formatChars(n.chars) : undefined,
                        morse: morseLines,
                        completion: status as LessonCompletion,
                      }}
                    />
                  ) : (
                    <CoinChallengeNode
                      data={{
                        id: String(n.id),
                        title: 'Challenge',
                        completion: status as ChallengeCompletion,
                      }}
                    />
                  )}
                </Pressable>
              </View>
              {openIndex === i && (
                <LessonPromptCard
                  groupId={groupId}
                  lessonId={String(n.id)}
                  label={n.label}
                  chars={n.chars}
                  canSend={
                    getLessonProgress(n.id).receiveScore >= thresholds.receive
                  }
                  disableActions={n.kind === 'challenge'}
                />
              )}
              {/* Segment below node (not after last) */}
              {i < derivedNodes.length - 1 && <View style={styles.segment} />}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  col: {
    width: '100%',
    paddingHorizontal: spacing(4),
  },
  segment: {
    alignSelf: 'center',
    width: 0,
    height: spacing(6),
    borderLeftWidth: 2,
    borderColor: colors.line,
    borderStyle: 'dotted',
    marginTop: 0,
    marginBottom: 0,
  },
});

function formatChars(chars: string[]) {
  return chars.join(' & ');
}
