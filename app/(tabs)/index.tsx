// Lessons Tab (Home)
// ------------------
// Composes the lessons screen out of small, focused components:
// - ProgressBar: compact coin-style summary of progress
// - NeonHeaderCard: centered title with menu and help buttons
// - LessonPath: vertical path of lesson and challenge nodes + prompt cards
// Routing and data shape are unchanged; we only read from the existing lesson
// list and the progress store. This file just wires the pieces together.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LESSON_GROUPS } from '../../data/lessons';
import { colors, spacing } from '../../theme/lessonTheme';
import NeonHeaderCard from '../../components/lessons/NeonHeaderCard';
import LessonPath from '../../components/lessons/LessonPath';
import ProgressBar from '@/components/lessons/ProgressBar';
import { useProgressStore } from '../../store/useProgressStore';

export default function LessonsScreen() {
  const [groupId, setGroupId] = React.useState(LESSON_GROUPS[0].id);
  const group = LESSON_GROUPS.find((g) => g.id === groupId)!;
  // Subscribe to progress state and compute counts via store helper.
  // Using two selectors keeps the subscription stable and avoids loops.
  const progress = useProgressStore((s) => s.progress);
  const getCountsGlobal = useProgressStore((s) => s.getCountsGlobal);
  const counts = React.useMemo(() => getCountsGlobal(), [getCountsGlobal, progress]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <ProgressBar counts={counts} />
        <NeonHeaderCard groupId={groupId} onChangeGroup={setGroupId} />
        <View style={{ height: spacing(0) }} />
        <LessonPath groupId={group.id} lessons={group.lessons} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: spacing(4), paddingHorizontal: spacing(4)},
});
