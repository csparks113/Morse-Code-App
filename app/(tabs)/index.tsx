// app/(tabs)/index.tsx
import React from "react";
import { View, StyleSheet, FlatList, Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header row (no card) */}
        <HeaderGroupPicker groupId={groupId} onChange={setGroupId} />

        {/* Divider + spacing under header */}
        <View style={styles.headerDivider} />

        <FlatList
          contentContainerStyle={{
            gap: theme.spacing(3),
            paddingBottom: theme.spacing(10),
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

                {/* Right: real, styled buttons (no Link asChild) */}
                <View style={styles.actions}>
                  {/* RECEIVE = circular button */}
                  <Pressable
                    onPress={() => router.push(receiveHref)}
                    style={({ pressed }) => [styles.receiveCircle, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Receive lesson"
                  >
                    <Ionicons name="play" size={20} color={theme.colors.background} />
                    <Text style={styles.btnText}>Receive</Text>
                  </Pressable>

                  {/* SEND = rectangular pill */}
                  {!receiveOnly && (
                    <Pressable
                      onPress={() => router.push(sendHref)}
                      style={({ pressed }) => [styles.sendRect, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel="Send lesson"
                    >
                      <Text style={styles.btnText}>Send</Text>
                      <Ionicons name="radio-outline" size={18} color={theme.colors.background} />
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
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },

  // lesson card container
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing(4),
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
    gap: theme.spacing(3),
    paddingLeft: theme.spacing(2),
  },

  // RECEIVE = circular, filled button
  receiveCircle: {
    backgroundColor: theme.colors.textSecondary, // Desert Sand
    borderRadius: 999,
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    elevation: 3, // Android
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },

  // SEND = rectangular pill
  sendRect: {
    backgroundColor: theme.colors.accent, // Rich Bronze
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing(3),
    paddingHorizontal: theme.spacing(5),
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: theme.spacing(2),
    minWidth: 118,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
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
