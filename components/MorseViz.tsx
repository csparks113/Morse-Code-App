// components/MorseViz.tsx
import React from "react";
import { View, StyleSheet } from "react-native";
import {
  MorseElement,
  textToMorseElements,
  unitMsFromWpm,
  pressesToElementsWithGaps,
  DEFAULT_DASH_UNITS,
} from "@/utils/morseUtils";

type CommonColorProps = {
  color?: string;
  backgroundColor?: string;
  inactiveColor?: string;
};

// --- Glyphs ---
type MorseGlyphProps = CommonColorProps & {
  symbol: "dot" | "dash";
  size?: number;
  dashRatio?: number;
  radius?: number;
  style?: any;
};

export function MorseGlyph({
  symbol,
  size = 12,
  dashRatio = 3,
  radius = 6,
  color = "#FFFFFF",
  backgroundColor = "transparent",
  style,
}: MorseGlyphProps) {
  const height = size;
  const width = symbol === "dot" ? size : Math.max(size, size * dashRatio);
  const shapeStyle =
    symbol === "dot"
      ? { width, height, borderRadius: width / 2, backgroundColor: color }
      : { width, height, borderRadius: radius, backgroundColor: color };
  return (
    <View style={[{ backgroundColor }, style]}>
      <View style={shapeStyle} />
    </View>
  );
}

type MorseGlyphRowProps = CommonColorProps & {
  pattern: string;
  size?: number;
  dashRatio?: number;
  gapPx?: number;
  style?: any;
};

export function MorseGlyphRow({
  pattern,
  size = 12,
  dashRatio = 3,
  gapPx = 6,
  color = "#FFFFFF",
  backgroundColor = "transparent",
  style,
}: MorseGlyphRowProps) {
  return (
    <View style={[styles.row, { backgroundColor }, style]}>
      {[...pattern].map((ch, i) => (
        <View key={`${i}`} style={{ marginRight: i < pattern.length - 1 ? gapPx : 0 }}>
          <MorseGlyph symbol={ch === "." ? "dot" : "dash"} size={size} dashRatio={dashRatio} color={color} />
        </View>
      ))}
    </View>
  );
}

// --- Timeline ---
type CanonicalSource =
  | { mode: "text"; text: string; wpm?: number; dashUnits?: number }
  | { mode: "elements"; elements: MorseElement[] };

type InputSource =
  | { mode: "presses"; presses: { startMs: number; endMs: number }[]; wpm?: number; granularity?: number }
  | CanonicalSource;

type MorseTimelineProps = CommonColorProps & {
  source: InputSource;
  height?: number;
  unitPx?: number;
  dashUnits?: number;
  rounded?: boolean;
  showGaps?: boolean;
  /** quantization grid (1 => unit, 4 => 1/4 unit). Default 1 for canonical, 4 for user input. */
  granularity?: number;
  style?: any;
};

export function MorseTimeline({
  source,
  height = 12,
  unitPx = 10,
  dashUnits = DEFAULT_DASH_UNITS,
  color = "#00D1FF",
  inactiveColor = "rgba(255,255,255,0.15)",
  backgroundColor = "transparent",
  rounded = true,
  showGaps = true,
  granularity,
  style,
}: MorseTimelineProps) {
  const wpm = (source as any).wpm ?? 12;
  const unitMs = unitMsFromWpm(wpm);

  const elements: MorseElement[] = React.useMemo(() => {
    if (source.mode === "text") {
      return textToMorseElements(source.text, dashUnits);
    }
    if (source.mode === "presses") {
      const g = source.granularity ?? granularity ?? 4;
      return pressesToElementsWithGaps(source.presses, unitMs, g);
    }
    return source.elements;
  }, [source, dashUnits, unitMs, granularity]);

  return (
    <View style={[{ backgroundColor, alignSelf: "center" }, style]}>
      <View
        style={[
          styles.timeline,
          {
            height,
            borderRadius: rounded ? height / 2 : 0,
          },
        ]}
      >
        {elements.map((el, idx) => {
          const isGap = el.kind === "gap";
          const rawWidth = Math.max(0, el.units * unitPx);
          // Ensure very short pulses render as perfect dots (circles)
          const width =
            !isGap && rawWidth < height ? height : Math.max(1, rawWidth);

          const segmentStyle = {
            width,
            height: "100%",
            borderRadius: rounded ? height / 2 : 0,
            backgroundColor: isGap
              ? (showGaps ? inactiveColor : "transparent")
              : color,
          } as const;

          return <View key={idx} style={segmentStyle} />;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  timeline: { flexDirection: "row", overflow: "hidden" },
});

export default { MorseGlyph, MorseGlyphRow, MorseTimeline };
