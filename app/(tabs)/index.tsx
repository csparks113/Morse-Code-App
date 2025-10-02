// Lessons Tab (Home)
// ------------------
// Composes the lessons screen out of the neon header and the card list.
// Routing and data shape are unchanged; we only read from the existing lesson
// list and the progress store via the nested components.
import React from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { LESSON_GROUPS } from '../../data/lessons';
import { colors, spacing } from '../../theme/lessonTheme';
import NeonHeaderCard from '@/components/NeonHeaderCard';
import LessonPath from '@/components/LessonPath';
import { useDeveloperStore } from '@/store/useDeveloperStore';

export default function LessonsScreen() {
  const [groupId, setGroupId] = React.useState(LESSON_GROUPS[0].id);
  const group = LESSON_GROUPS.find((g) => g.id === groupId)!;

  const developerMode = useDeveloperStore((state) => state.developerMode);
  const router = useRouter();

  const handleOpenDev = React.useCallback(() => {
    if (developerMode) {
      router.push('/dev');
    }
  }, [developerMode, router]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        {developerMode ? (
          <View style={styles.headerWrapper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open developer console"
              accessibilityHint="Long-press to open the developer tools"
              onLongPress={handleOpenDev}
              delayLongPress={600}
            >
              <NeonHeaderCard groupId={groupId} onChangeGroup={setGroupId} />
            </Pressable>
            <View style={styles.devBadge} pointerEvents="none">
              <Text style={styles.devBadgeText}>DEV</Text>
            </View>
          </View>
        ) : (
          <NeonHeaderCard groupId={groupId} onChangeGroup={setGroupId} />
        )}

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
    paddingTop: spacing(2),
    paddingHorizontal: spacing(0),
  },
  headerWrapper: {
    position: 'relative',
  },
  devBadge: {
    position: 'absolute',
    top: spacing(1),
    right: spacing(1),
    backgroundColor: colors.gold,
    borderRadius: 12,
    paddingHorizontal: spacing(1),
    paddingVertical: spacing(0.25),
  },
  devBadgeText: {
    color: colors.bg,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
