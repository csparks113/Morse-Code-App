import React from "react";
import { Pressable, StyleSheet, StyleProp, Text, View, ViewStyle } from "react-native";

import { colors, spacing, surfaces, sessionControlTheme } from "@/theme/lessonTheme";

type LessonChoicesProps = {
  choices: string[];
  onChoose: (value: string) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const lessonChoiceTheme = sessionControlTheme.lessonChoice;

function LessonChoices({
  choices,
  onChoose,
  disabled = false,
  style,
}: LessonChoicesProps) {
  return (
    <View style={[styles.container, style]}>
      {choices.map((choice) => (
        <Pressable
          key={choice}
          onPress={() => onChoose(choice)}
          disabled={disabled}
          style={({ pressed }) => [
            styles.choice,
            pressed && !disabled ? styles.choicePressed : null,
            disabled ? styles.choiceDisabled : null,
          ]}
        >
          <Text style={styles.choiceText}>{choice}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing(2),
  },
  choice: {
    flex: 1,
    borderRadius: lessonChoiceTheme.borderRadius,
    borderWidth: lessonChoiceTheme.borderWidth,
    borderColor: colors.border,
    backgroundColor: surfaces.sunken,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing(lessonChoiceTheme.paddingVerticalStep),
  },
  choicePressed: {
    backgroundColor: surfaces.pressed,
  },
  choiceDisabled: {
    opacity: 0.5,
  },
  choiceText: {
    color: colors.text,
    fontSize: lessonChoiceTheme.fontSize,
    fontWeight: "800",
    letterSpacing: lessonChoiceTheme.letterSpacing,
  },
});

export default LessonChoices;


