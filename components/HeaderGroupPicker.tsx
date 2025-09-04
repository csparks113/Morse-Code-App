// components/HeaderGroupPicker.tsx
// --------------------------------
// Pressable header that shows the current group title.
// Tapping it opens a modal with a list of groups and their progress bars.
// Selecting a group calls onChange(groupId).

import React from "react";
import { Modal, Pressable, StyleSheet, Text, View, FlatList } from "react-native";
import { theme } from "../constants/theme";
import { LESSON_GROUPS } from "../data/lessons";
import { useProgressStore } from "../store/useProgressStore";

type Props = {
  groupId: string;
  onChange: (id: string) => void;
};

export default function HeaderGroupPicker({ groupId, onChange }: Props) {
  const [open, setOpen] = React.useState(false);
  const current = LESSON_GROUPS.find((g) => g.id === groupId);
  const getCompletionRatio = useProgressStore((s) => s.getCompletionRatio);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.header}>
        <Text style={styles.headerTitle}>{current?.title ?? "Select Group"}</Text>
        <Text style={styles.headerSubtitle}>Tap to view all groups & progress</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Lesson Groups</Text>

            <FlatList
              data={LESSON_GROUPS}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => <View style={{ height: theme.spacing(3) }} />}
              renderItem={({ item }) => {
                const ratio = getCompletionRatio(item.id, item.lessons.length);
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.id);
                      setOpen(false);
                    }}
                    style={styles.groupRow}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.groupTitle}>{item.title}</Text>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
                      </View>
                      <Text style={styles.progressLabel}>{Math.round(ratio * 100)}% complete</Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                );
              }}
            />

            <Pressable onPress={() => setOpen(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingVertical: theme.spacing(3),
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: theme.colors.muted,
    marginTop: theme.spacing(1),
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    padding: theme.spacing(4),
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing(4),
    gap: theme.spacing(3),
  },
  modalTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subtitle,
    fontWeight: "800",
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(3),
    paddingVertical: theme.spacing(2),
  },
  groupTitle: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    marginBottom: theme.spacing(2),
  },
  progressTrack: {
    height: 12,
    backgroundColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: theme.colors.textSecondary,
  },
  progressLabel: {
    color: theme.colors.muted,
    marginTop: theme.spacing(1),
    fontSize: theme.typography.small,
  },
  chevron: {
    color: theme.colors.textSecondary,
    fontSize: 28,
    paddingHorizontal: theme.spacing(2),
  },
  closeBtn: {
    alignSelf: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing(6),
    paddingVertical: theme.spacing(3),
  },
  closeBtnText: {
    color: theme.colors.background,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
