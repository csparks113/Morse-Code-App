// Lessons Tab (Home)
// ------------------
// Composes the lessons screen out of the neon header and the card list.
// Routing and data shape are unchanged; we only read from the existing lesson
// list and the progress store via the nested components.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LESSON_GROUPS } from '../../data/lessons';
import { colors, spacing } from '../../theme/lessonTheme';
import NeonHeaderCard from '@/components/NeonHeaderCard';
import LessonPath from '@/components/LessonPath';

export default function LessonsScreen() {
  const [groupId, setGroupId] = React.useState(LESSON_GROUPS[0].id);
  const group = LESSON_GROUPS.find((g) => g.id === groupId)!;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <NeonHeaderCard groupId={groupId} onChangeGroup={setGroupId} />
        <LessonPath groupId={group.id} lessons={group.lessons} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: spacing(4),
    paddingHorizontal: spacing(4),
  },
});
