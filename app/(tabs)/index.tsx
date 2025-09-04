// app/(tabs)/index.tsx
import React from "react";
import { View, StyleSheet, FlatList, Pressable, Text } from "react-native";
import { Link /* add this type for clarity */, type Href } from "expo-router";
import { theme } from "../../constants/theme";
import HeaderGroupPicker from "../../components/HeaderGroupPicker";
import { LESSON_GROUPS } from "../../data/lessons";
import { useSettingsStore } from "../../store/useSettingsStore";

export default function LessonsScreen() {
  const [groupId, setGroupId] = React.useState(LESSON_GROUPS[0].id);
  const group = LESSON_GROUPS.find((g) => g.id === groupId)!;
  const receiveOnly = useSettingsStore((s) => s.receiveOnly);

  return (
    <View style={styles.container}>
      <HeaderGroupPicker groupId={groupId} onChange={setGroupId} />

      <FlatList
        contentContainerStyle={{ gap: theme.spacing(3), paddingBottom: theme.spacing(10) }}
        data={group.lessons}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          // ✅ Strongly-typed hrefs
          const receiveHref: Href = {
            pathname: "/lessons/[group]/[lessonId]/receive",
            params: { group: group.id, lessonId: item.id },
          };
          const sendHref: Href = {
            pathname: "/lessons/[group]/[lessonId]/send",
            params: { group: group.id, lessonId: item.id },
          };

          return (
            <View style={styles.card}>
              <View style={{ gap: theme.spacing(1) }}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.chars}>{item.chars.join(", ")}</Text>
              </View>

              <View style={styles.actions}>
                <Link href={receiveHref} asChild>
                  <Pressable style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}>
                    <Text style={styles.btnText}>Receive</Text>
                  </Pressable>
                </Link>

                {!receiveOnly && (
                  <Link href={sendHref} asChild>
                    <Pressable style={({ pressed }) => [styles.btnSecondary, pressed && styles.btnPressed]}>
                      <Text style={styles.btnText}>Send</Text>
                    </Pressable>
                  </Link>
                )}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(4) },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing(4),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
    gap: theme.spacing(3),
  },
  label: { color: theme.colors.textPrimary, fontSize: theme.typography.subtitle, fontWeight: "700" },
  chars: { color: theme.colors.muted, fontSize: theme.typography.body, letterSpacing: 1 },
  actions: { flexDirection: "row", gap: theme.spacing(2) },
  btn: { flex: 1, backgroundColor: theme.colors.accent, borderRadius: theme.radius.md, paddingVertical: theme.spacing(3), alignItems: "center" },
  btnSecondary: { flex: 1, backgroundColor: theme.colors.textSecondary, borderRadius: theme.radius.md, paddingVertical: theme.spacing(3), alignItems: "center" },
  btnPressed: { opacity: 0.9 },
  btnText: { color: theme.colors.background, fontWeight: "700" },
});
