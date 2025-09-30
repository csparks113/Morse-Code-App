import React from "react";
import { StyleSheet, StyleProp, View, ViewStyle } from "react-native";

import RevealBar from "@/components/session/RevealBar";
import { MorseTimeline } from "@/components/MorseViz";
import { colors } from "@/theme/lessonTheme";
import type { PressWindow } from "@/utils/morseUtils";

/**
 * MorseCompare
 * ------------
 * A small, reusable visualization wrapper used by Send/Receive/practice flows.
 *
 * Purpose:
 * - While the user is still answering ("guessing" mode), show a compact timeline
 *   of *their* raw key-down/key-up windows (press windows) so they get immediate
 *   proprioceptive feedback about the rhythm they just produced.
 * - After the answer is revealed or correctly entered ("compare" mode), switch to
 *   a target-vs-user comparison using <RevealBar mode="compare">. If we do not
 *   have any user presses (e.g., they hit Reveal immediately), fall back to
 *   showing just the canonical timeline for the target.
 *
 * Inputs:
 * - mode: "guessing" | "compare" — controls which visualization we render.
 * - char: the canonical glyph to render/compare against (e.g., "K").
 * - presses: an array of { startMs, endMs } describing user press windows.
 * - wpm: the current dot-unit speed (used to scale both timeline and compare).
 * - size: visual density; adjusts unit pixel scale + heights.
 * - topColor/bottomColor: color accents for the “target” and “user” tracks.
 * - align: left/center alignment for the block.
 * - style: optional outer container style.
 */

type Mode = "guessing" | "compare";
type Size = "sm" | "md";
type Align = "left" | "center";

type MorseCompareProps = {
  mode: Mode;
  char?: string;                 // Canonical character to visualize (optional so guessing mode can exist without it)
  presses: PressWindow[];        // Raw user-input windows used for timelines/compare
  wpm: number;                   // Controls unit timing (1 unit = 1200 / wpm ms)
  size?: Size;                   // Visual preset; defaults to "md"
  topColor?: string;             // Color for target track
  bottomColor?: string;          // Color for user track
  align?: Align;                 // Horizontal alignment (mostly for centering inside cards)
  style?: StyleProp<ViewStyle>;  // Optional container style pass-through
};

/**
 * Size presets: "unitPx" maps a dot unit to pixels; also tweak timeline height.
 * Keep these small; the idea is to be compact under the PromptCard reveal area.
 */
const SIZE_CONFIG: Record<Size, { unitPx: number; timelineHeight: number }> = {
  sm: { unitPx: 9,  timelineHeight: 10 },
  md: { unitPx: 12, timelineHeight: 12 },
};

function MorseCompare({
  mode,
  char,
  presses,
  wpm,
  size = "md",
  topColor = colors.blueNeon,
  bottomColor = colors.gold,
  align = "center",
  style,
}: MorseCompareProps) {
  // Look up the size preset and translate align prop to flexbox value
  const config = SIZE_CONFIG[size];
  const alignItems = align === "left" ? "flex-start" : "center";
  const justifyContent = mode === "compare" ? "flex-start" : "center";

  // -------------------------------
  // COMPARE MODE
  // -------------------------------
  // After reveal/correct: show the canonical vs user overlay if we have presses.
  // If the user never keyed anything (e.g., hit Reveal immediately), render the
  // canonical timeline only so they still learn what they should have keyed.
  if (mode === "compare") {
    // No user input -> render single canonical timeline in the top color
    if (!presses.length) {
      return (
        <View style={[styles.container, { alignItems, justifyContent }, style]}>
          <RevealBar
            mode="timeline"        // draw just the target glyph as a timeline
            char={char}
            visible={true}
            size={size}
            wpm={wpm}
            unitPx={config.unitPx} // scale dots/dashes to pixels
            color={topColor}
            align={align}
            showGaps={false}
          />
        </View>
      );
    }

    // We do have user input -> render full target vs user comparison
    return (
      <View style={[styles.container, { alignItems, justifyContent }, style]}>
        <RevealBar
          mode="compare"           // overlay target (top) vs user presses (bottom)
          char={char}
          presses={presses}
          visible={true}
          size={size}
          wpm={wpm}
          unitPx={config.unitPx}
          showLegend={false}       // compact look: omit the mini legend
          topColor={topColor}      // target track
          bottomColor={bottomColor}// user track
          align={align}
        />
      </View>
    );
  }

  // -------------------------------
  // GUESSING MODE
  // -------------------------------
  // While the user is still answering, render *only* their press timeline.
  // This avoids giving away the target pattern while still giving rhythm feedback.
  return (
    <View style={[styles.container, { alignItems, justifyContent }, style]}>
      <MorseTimeline
        // Source "presses" means: draw bars exactly where the user pressed
        source={{ mode: "presses", presses, wpm, granularity: 16 }}
        unitPx={config.unitPx}         // same pixel scale as compare view
        height={config.timelineHeight} // compact bar height
        color={bottomColor}            // use user color in guessing mode
        inactiveColor="transparent"    // no background grid
        showGaps={false}               // keep it minimal; just show active presses
        rounded                        // rounded bar caps for a softer look
        style={{
          // Allow aligning the entire bar to the left for certain layouts
          alignSelf: align === "left" ? "flex-start" : "center",
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "stretch",  // take full width of parent card
  },
});

export default MorseCompare;
