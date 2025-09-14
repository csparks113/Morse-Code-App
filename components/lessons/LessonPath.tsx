// LessonPath
// ----------
// Renders the vertical dotted path of lessons:
//  - Each node sits on the center line
//  - A small dotted segment connects nodes (but never above the first)
//  - Tapping a node reveals a prompt card under it
// The component is pure layout/interaction; progression state comes from the store.
import React from 'react';
import { View, ScrollView, StyleSheet, Text, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, thresholds } from '../../theme/lessonTheme';
import LessonNode, { NodeStatus } from './LessonNode';
import LessonPromptCard from './LessonPromptCard';
import { useProgressStore } from '../../store/useProgressStore';

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
      // Keep last node clear of the tab bar without a tall black band
      paddingBottom: insets.bottom + spacing(1),
    }),
    [insets.bottom],
  );

  return (
    <ScrollView contentContainerStyle={contentStyle}>
      <View style={styles.col}>
        <View style={{ height: firstPad }} />
        {derivedNodes.map((n, i) => (
          <View key={n.key} style={{ marginBottom: 0 }}>
            {/* Node */}
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.lessonLabel}>{n.label}</Text>
              {n.kind === 'lesson' && (
                <Text style={styles.lessonChars}>{formatChars(n.chars)}</Text>
              )}
              {renderNode({
                node: n,
                index: i,
                openIndex,
                setOpenIndex,
                groupId,
                getLessonProgress,
                lessons,
              })}
            </View>
            {/* Segment below node (not after last) */}
            {i < derivedNodes.length - 1 && <View style={styles.segment} />}
            {openIndex === i && (
              <LessonPromptCard
                groupId={groupId}
                lessonId={String(n.id)}
                label={n.label}
                chars={n.chars}
                canSend={getLessonProgress(n.id).receiveScore >= thresholds.receive}
                disableActions={n.kind === 'challenge'}
              />
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// Render a single node with computed status and accessibility label
function renderNode({ node, index, openIndex, setOpenIndex, groupId, getLessonProgress, lessons }: {
  node: { kind: 'lesson' | 'challenge'; id: string };
  index: number;
  openIndex: number | null;
  setOpenIndex: React.Dispatch<React.SetStateAction<number | null>>;
  groupId: string;
  getLessonProgress: (lessonId: string) => { receiveScore: number; sendScore: number };
  lessons: Lesson[];
}) {
  const isChallenge = node.kind === 'challenge';

  // Availability rules
  let available = true;
  if (!isChallenge) {
    const pos = lessons.findIndex((l) => l.id === node.id);
    if (pos > 0) {
      const prevId = lessons[pos - 1].id;
      available = getLessonProgress(prevId).receiveScore >= thresholds.receive;
    }
  } else {
    const nStr = node.id.replace('ch-', '');
    const n = parseInt(nStr, 10);
    const prevIdx = Math.min(n * 2 - 1, lessons.length - 1);
    if (prevIdx >= 0) {
      const prevId = lessons[prevIdx].id;
      available = getLessonProgress(prevId).receiveScore >= thresholds.receive;
    }
  }

  const p = getLessonProgress(node.id);
  const status: NodeStatus = isChallenge
    ? p.sendScore >= thresholds.send
      ? 'CHALLENGE_MASTERED'
      : p.receiveScore >= thresholds.receive
      ? 'CHALLENGE_RECEIVE_DONE'
      : available
      ? 'CHALLENGE_AVAILABLE'
      : 'LOCKED'
    : p.sendScore >= thresholds.send
    ? 'MASTERED'
    : p.receiveScore >= thresholds.receive
    ? 'RECEIVE_DONE'
    : available
    ? 'AVAILABLE'
    : 'LOCKED';

  return (
    <LessonNode
      index={index}
      isChallenge={isChallenge}
      status={status}
      onPress={() => setOpenIndex((cur) => (cur === index ? null : index))}
      open={openIndex === index}
      accessibilityLabel={buildA11yLabel(isChallenge, status)}
    />
  );
}

function buildA11yLabel(isChallenge: boolean, status: NodeStatus) {
  const base = isChallenge ? "Challenge" : "Lesson";
  const map: Record<NodeStatus, string> = {
    LOCKED: "Locked",
    AVAILABLE: "Available",
    RECEIVE_DONE: "Receive complete. Send locked.",
    MASTERED: "Mastered.",
    CHALLENGE_AVAILABLE: "Challenge available",
    CHALLENGE_RECEIVE_DONE: "Challenge receive complete. Send locked.",
    CHALLENGE_MASTERED: "Challenge mastered.",
  };
  return `${base} - ${map[status]}`;
}

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing(2),
    paddingBottom: spacing(8),
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
  lessonLabel: { color: colors.text, fontWeight: '800', marginBottom: spacing(0.25), fontSize: 18 },
  lessonChars: { color: colors.textDim, marginBottom: spacing(1), fontSize: 14 },
});

function formatChars(chars: string[]) {
  return chars.join(' & ');
}











