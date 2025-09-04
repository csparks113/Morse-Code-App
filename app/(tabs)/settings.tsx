// app/(tabs)/settings.tsx
// -----------------------
// Settings screen with the "Receive-only" toggle. When enabled, Send buttons are hidden everywhere.

import React from "react";
import { View, Text, StyleSheet, Switch } from "react-native";
import { theme } from "../../constants/theme";
import { useSettingsStore } from "../../store/useSettingsStore";

export default function SettingsScreen() {
  const receiveOnly = useSettingsStore((s) => s.receiveOnly);
  const setReceiveOnly = useSettingsStore((s) => s.setReceiveOnly);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>Receive-only mode</Text>
          <Text style={styles.rowSub}>Only show Receive lessons (hide Send)</Text>
        </View>
        <Switch
          value={receiveOnly}
          onValueChange={setReceiveOnly}
          trackColor={{ true: theme.colors.textSecondary, false: theme.colors.border }}
          thumbColor={receiveOnly ? theme.colors.accent : "#888"}
        />
      </View>

      {/* Placeholders for future toggles (audio/light/haptics) */}
      {/* <SettingsToggle label="Audio" /> etc. */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(4), gap: theme.spacing(4) },
  title: { color: theme.colors.textPrimary, fontSize: theme.typography.title, fontWeight: "800" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing(4),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
    gap: theme.spacing(2),
  },
  rowTitle: { color: theme.colors.textPrimary, fontWeight: "700" },
  rowSub: { color: theme.colors.muted, marginTop: theme.spacing(1), fontSize: theme.typography.small },
});
