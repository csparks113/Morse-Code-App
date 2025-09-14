// Lessons Tab (Home)
// ------------------
// Composes the lessons screen out of small, focused components:
// - HeaderCounters: shows quick progress summary
// - NeonHeaderCard: centered title with menu and help buttons
// - LessonPath: vertical path of lesson nodes and prompt cards
// Routing and data shape are unchanged; we only read from the existing lesson list
// and the progress store. This file just wires the pieces together.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LESSON_GROUPS } from '../../data/lessons';
import { colors, spacing } from '../../theme/lessonTheme';
import NeonHeaderCard from '../../components/lessons/NeonHeaderCard';
import HeaderCounters from '../../components/lessons/HeaderCounters';
import LessonPath from '../../components/lessons/LessonPath';
import { useProgressStore } from '../../store/useProgressStore';

export default function LessonsScreen() {
  const [groupId, setGroupId] = React.useState(LESSON_GROUPS[0].id);
  const group = LESSON_GROUPS.find((g) => g.id === groupId)!;
  const progress = useProgressStore((s) => s.progress);

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <HeaderCounters groupId={group.id} lessons={group.lessons} getLessonProgress={getLessonProgress} />
        <NeonHeaderCard groupId={groupId} onChangeGroup={setGroupId} />
        <View style={{ height: spacing(2) }} />
        <LessonPath groupId={group.id} lessons={group.lessons} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing(4) },
});
