import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { theme } from '../constants/theme';
import { LESSON_GROUPS } from '../data/lessons';
import { useProgressStore } from '../store/useProgressStore';

type Props = {
  groupId: string;
  onChange: (id: string) => void;
};

export default function HeaderGroupPicker({ groupId, onChange }: Props) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  const current = React.useMemo(
    () => LESSON_GROUPS.find((g) => g.id === groupId),
    [groupId],
  );
  const getCompletionRatio = useProgressStore((s) => s.getCompletionRatio);

  const overviewHref: Href = {
    pathname: '/lessons/[group]/overview',
    params: { group: current?.id ?? 'alphabet' },
  };

  return (
    <View>
      {/* Simple header row (no card) with title on the left and icons on the right */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>
          {`Lessons: ${current?.title ?? 'Select Group'}`}
        </Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setOpen(true)}
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && styles.iconBtnPressed,
            ]}
            accessibilityLabel="Open groups and progress"
          >
            <Ionicons name="menu" size={20} color={theme.colors.background} />
          </Pressable>
          <Pressable
            onPress={() => router.push(overviewHref)}
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && styles.iconBtnPressed,
            ]}
            accessibilityLabel="Open group overview"
          >
            <Ionicons
              name="help-circle-outline"
              size={20}
              color={theme.colors.background}
            />
          </Pressable>
        </View>
      </View>

      {/* Modal: groups + progress */}
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
                <View style={{ height: theme.spacing(3) }} />
              )}
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
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${ratio * 100}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.progressLabel}>
                        {Math.round(ratio * 100)}% complete
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
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
  headerRow: {
    paddingVertical: theme.spacing(4),
    paddingHorizontal: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: theme.spacing(1),
  },
  headerTitle: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: theme.spacing(4),
    marginRight: theme.spacing(1.5),
  },
  iconBtn: {
    backgroundColor: theme.colors.textSecondary, // Desert Sand pill
    borderRadius: theme.radius.pill,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: { opacity: 0.9 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
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
    fontWeight: '800',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    paddingVertical: theme.spacing(2),
  },
  groupTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    marginBottom: theme.spacing(2),
  },
  progressTrack: {
    height: 12,
    backgroundColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
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
    alignSelf: 'center',
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing(6),
    paddingVertical: theme.spacing(3),
  },
  closeBtnText: {
    color: theme.colors.background,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
