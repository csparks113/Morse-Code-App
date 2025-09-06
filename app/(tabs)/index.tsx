// app/(tabs)/index.tsx
import React from "react";
import { View, StyleSheet, FlatList, Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { theme } from "../../constants/theme";
import HeaderGroupPicker from "../../components/HeaderGroupPicker";
import { LESSON_GROUPS } from "../../data/lessons";
import { useSettingsStore } from "../../store/useSettingsStore";

export default function LessonsScreen() {
  const router = useRouter();
  const [groupId, setGroupId] = React.useState(LESSON_GROUPS[0].id);
  const group = LESSON_GROUPS.find((g) => g.id === groupId)!;
  const receiveOnly = useSettingsStore((s) => s.receiveOnly);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        {/* Header row (no card) */}
        <HeaderGroupPicker groupId={groupId} onChange={setGroupId} />

        {/* Divider + spacing under header */}
        <View style={styles.headerDivider} />

        <FlatList
          contentContainerStyle={{
            gap: theme.spacing(4),
            paddingBottom: theme.spacing(1),
          }}
          data={group.lessons}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
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
                {/* Left: lesson info */}
                <View style={styles.meta}>
                  <Text style={styles.label}>{item.label}</Text>
                  <Text style={styles.chars}>{item.chars.join(", ")}</Text>
                </View>

                {/* Right: two equal buttons (Receive / Send), same shape */}
                <View style={styles.actions}>
                  {/* RECEIVE */}
                  <Pressable
                    onPress={() => router.push(receiveHref)}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      styles.receiveBtn,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Receive lesson"
                  >
                    <Text style={styles.btnText}>Receive</Text>
                  </Pressable>

                  {/* SEND */}
                  {!receiveOnly && (
                    <Pressable
                      onPress={() => router.push(sendHref)}
                      style={({ pressed }) => [
                        styles.actionBtn,
                        styles.sendBtn,
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Send lesson"
                    >
                      <Text style={styles.btnText}>Send</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(4) },

  // divider under header
  headerDivider: {
    height: 2,
    backgroundColor: theme.colors.textSecondary,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },

  // lesson card container
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    paddingVertical: theme.spacing(4),
    paddingHorizontal: theme.spacing(4),
    minHeight: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
    flexDirection: "row",
    alignItems: "center",
  },

  // left-side meta
  meta: { flex: 1, minWidth: 120, gap: theme.spacing(1) },
  label: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subtitle,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  chars: { color: theme.colors.muted, fontSize: theme.typography.body, letterSpacing: 1 },

  // right-side actions (keeps buttons off the edge)
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing(2.5),
    paddingLeft: 0,
    marginRight: theme.spacing(4),
  },

  // Shared rectangular buttons
  actionBtn: {
    backgroundColor: theme.colors.accent, // base, overridden per button
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing(3),
    paddingHorizontal: theme.spacing(3),
    alignItems: "center",
    justifyContent: "center",
    elevation: 3, // Android
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    minWidth: 92,
  },
  receiveBtn: {
    backgroundColor: theme.colors.textSecondary, // Receive = Desert Sand
  },
  sendBtn: {
    backgroundColor: theme.colors.accent, // Send = Rich Bronze
  },

  // shared button text
  btnText: {
    color: theme.colors.background,
    fontWeight: "800",
    fontSize: 13,
    letterSpacing: 0.3,
  },

  // press feedback
  pressed: { opacity: 0.92 },
});
