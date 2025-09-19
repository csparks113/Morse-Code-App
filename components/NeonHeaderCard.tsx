// NeonHeaderCard
// --------------
// Centered header with a neon outline and inline progress bar.
// Left button opens the groups modal; right button opens the overview.
// The middle shows the current section and group title.

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { colors, glow, radii, spacing, thresholds } from '../theme/lessonTheme';
import { LESSON_GROUPS } from '../data/lessons';
import { useProgressStore } from '../store/useProgressStore';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  groupId: string;
  onChangeGroup: (id: string) => void;
};

export default function NeonHeaderCard({ groupId, onChangeGroup }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const group = React.useMemo(
    () => LESSON_GROUPS.find((g) => g.id === groupId)!,
    [groupId],
  );
  const sectionIndex =
    Math.max(
      0,
      LESSON_GROUPS.findIndex((g) => g.id === groupId),
    ) + 1;

  const getCompletionRatio = useProgressStore((s) => s.getCompletionRatio);
  const progress = useProgressStore((s) => s.progress);

  const bar = React.useMemo(() => {
    const g = group;
    if (!g) return { total: 0, done: 0, ratio: 0 };
    const lessons = g.lessons;
    const chCount = Math.floor(lessons.length / 2);
    const ids = [
      ...lessons.map((l) => l.id),
      ...Array.from({ length: chCount }, (_, i) => `ch-${i + 1}`),
    ];
    let done = 0;
    const total = ids.length * 2;
    const groupProg = progress[g.id] ?? {};
    ids.forEach((id) => {
      const p = groupProg[id];
      const receive =
        (p?.receiveScore ?? (p?.receive ? 100 : 0)) >= thresholds.receive;
      const send = (p?.sendScore ?? (p?.send ? 100 : 0)) >= thresholds.send;
      if (receive) done += 1;
      if (send) done += 1;
    });
    return { total, done, ratio: total === 0 ? 0 : done / total };
  }, [group, progress]);

  const overviewHref: Href = {
    pathname: '/lessons/[group]/overview',
    params: { group: group.id },
  };

  return (
    <View>
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.side}>
            <Pressable
              onPress={() => setOpen(true)}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && styles.pressed,
              ]}
              accessibilityLabel="Open groups"
            >
              <Ionicons name="menu" size={24} color={colors.bg} />
            </Pressable>
          </View>

          <View style={styles.centerTextWrap}>
            <Text style={styles.section}>Section {sectionIndex}</Text>
            <Text style={styles.title}>{group.title}</Text>

            <View
              style={styles.headerBarTrack}
              accessibilityRole="progressbar"
              accessibilityLabel="Section progress"
              accessibilityValue={{ min: 0, max: bar.total, now: bar.done }}
            >
              <LinearGradient
                colors={['#FFD700', '#FFC837', '#FFB347']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.headerBarFill, { width: `${bar.ratio * 100}%` }]}
              />
            </View>
          </View>

          <View style={styles.side}>
            <Pressable
              onPress={() => router.push(overviewHref)}
              style={({ pressed }) => [
                styles.iconBtn,
                pressed && styles.pressed,
              ]}
              accessibilityLabel="Help"
            >
              <Ionicons name="help" size={24} color={colors.bg} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Groups modal unchanged (progress colors tuned to blueNeon) */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Lesson Groups</Text>
            <FlatList
              data={LESSON_GROUPS}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => (
                <View style={{ height: spacing(2) }} />
              )}
              renderItem={({ item }) => {
                const ratio = getCompletionRatio(item.id, item.lessons.length);
                return (
                  <Pressable
                    onPress={() => {
                      onChangeGroup(item.id);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.groupRow,
                      pressed && { opacity: 0.92 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.groupTitle}>{item.title}</Text>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${ratio * 100}%` },
                          ]}
                        />
                      </View>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.blueNeon}
                    />
                  </Pressable>
                );
              }}
            />
            <Pressable
              onPress={() => setOpen(false)}
              style={styles.closeBtn}
              accessibilityLabel="Close"
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  side: { width: 50, alignItems: 'center', justifyContent: 'center' },

  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 999,
    backgroundColor: colors.blueNeon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.95 },

  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
    alignSelf: 'stretch',
    marginHorizontal: -spacing(3),
    marginBottom: spacing(2.5), // more breathing room below header
    ...glow.neon,
  },

  centerTextWrap: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  section: { color: colors.textDim, fontSize: 13, marginBottom: 2 }, // smaller section label
  title: { color: colors.text, fontWeight: '800', fontSize: 30 }, // larger title

  headerBarTrack: {
    height: 10, // thicker bar
    backgroundColor: '#2A2F36',
    borderRadius: 999,
    marginTop: spacing(1.25),
    width: '70%',
    overflow: 'hidden',
  },
  headerBarFill: { height: '100%' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: spacing(4),
  },
  modalCard: {
    backgroundColor: '#101010',
    borderRadius: radii.xl,
    padding: spacing(3),
    gap: spacing(2),
  },
  modalTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 20,
    marginBottom: spacing(1),
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingVertical: spacing(1.5),
  },
  groupTitle: {
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing(1),
  },
  progressTrack: {
    height: 10,
    backgroundColor: 'rgba(10,132,255,0.25)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.blueNeon },
  closeBtn: {
    alignSelf: 'center',
    backgroundColor: colors.blueNeon,
    borderRadius: 999,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  closeBtnText: { color: colors.bg, fontWeight: '800' },
});
