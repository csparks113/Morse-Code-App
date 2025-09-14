// Group Overview screen
// ---------------------
// Shows a quick summary of a lesson group: title, all unique characters
// taught inside the group, and a simple list of lessons. This view is
// accessed via the help button in the lessons header.
import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { theme } from '../../../theme/theme';
import { getGroupById } from '../../../data/lessons';

export default function GroupOverviewScreen() {
  const { group } = useLocalSearchParams<{ group: string }>();
  const g = getGroupById(group || 'alphabet');

  if (!g) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>Group not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const allChars = Array.from(new Set(g.lessons.flatMap((l) => l.chars)));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>{g.title} Overview</Text>
        <Text style={styles.sub}>
          You’ll learn to recognize and key these characters:
        </Text>
        <View style={styles.pillRow}>
          {allChars.map((c) => (
            <View key={c} style={styles.pill}>
              <Text style={styles.pillText}>{c}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sub, { marginTop: theme.spacing(4) }]}>
          Lessons in this group
        </Text>
        <FlatList
          data={g.lessons}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{
            gap: theme.spacing(2),
            paddingTop: theme.spacing(2),
          }}
          renderItem={({ item }) => (
            <View style={styles.lessonRow}>
              <Text style={styles.lessonTitle}>{item.label}</Text>
              <Text style={styles.lessonChars}>{item.chars.join(', ')}</Text>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing(4),
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: '800',
  },
  sub: { color: theme.colors.muted, marginTop: theme.spacing(2) },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
  pill: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1.5),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  pillText: { color: theme.colors.textPrimary, fontWeight: '700' },
  lessonRow: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing(3),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  lessonTitle: { color: theme.colors.textPrimary, fontWeight: '700' },
  lessonChars: { color: theme.colors.muted, marginTop: 4 },
});
