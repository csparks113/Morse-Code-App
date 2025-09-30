// components/session/RevealBar.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/lessonTheme';
import { MorseGlyphRow, MorseTimeline } from '@/components/MorseViz';
import {
  textToMorseElements,
  DEFAULT_DASH_UNITS,
  INTRA_CHAR_GAP_UNITS,
  unitMsFromWpm,
  pressesToElementsWithGaps,
  type MorseElement,
  type PressWindow,
} from '@/utils/morseUtils';

/**
 * RevealBar
 * ----------
 * A compact, mode-driven widget for visualizing Morse in three ways:
 *
 * 1) mode="glyphs"
 *    - Shows a static dot/dash row (no timing), good for "pattern only".
 *
 * 2) mode="timeline"
 *    - Renders the canonical timing pattern as a single bar timeline
 *      (scaled by WPM and unitPx).
 *
 * 3) mode="compare"
 *    - Two stacked timelines: "Target" (canonical) and "You" (user presses).
 *    - If there are no user presses yet, we still show the canonical line so
 *      the learner can see what the answer looks like.
 *
 * Notes:
 * - "unitPx" maps one dot-unit to pixels, so visuals remain consistent with
 *   timing elsewhere in the app. Keep it in sync with components like
 *   MorseCompare/MorseTimeline.
 * - We intentionally hide gaps in compare timelines (showGaps=false) to keep
 *   the compare block neat, while spacing still honors gap lengths.
 */

type Size = 'sm' | 'md' | 'lg';
type Align = 'center' | 'left';

type BaseProps = {
  visible: boolean; // external control to fade/hold this block (opacity toggle)
  size?: Size;      // preset for density (affects glyph/timeline sizes)
  align?: Align;    // horizontal alignment within parent card
  color?: string;   // primary accent color (glyphs or single timeline)
};

type GlyphsModeProps = BaseProps & {
  mode?: 'glyphs';        // default mode
  morse?: string | null;  // pattern like ".-.-" (if not using char)
};

type TimelineModeProps = BaseProps & {
  mode: 'timeline';
  char?: string | null;   // one-character canonical source (preferred)
  morse?: string | null;  // raw pattern (fallback if char not provided)
  wpm?: number;           // speed to scale timing
  dashUnits?: number;     // usually 3 (dash == 3 dots)
  unitPx?: number;        // pixels per unit
  showGaps?: boolean;     // whether to render "inactive" gaps visibly
  barHeight?: number;     // px height of the bar
};

type CompareModeProps = BaseProps & {
  mode: 'compare';
  char?: string | null;   // canonical target for top row
  morse?: string | null;  // optional direct pattern
  presses: PressWindow[]; // user press windows for bottom row
  wpm?: number;
  dashUnits?: number;
  unitPx?: number;
  showGaps?: boolean;     // controls gaps only for canonical row (we keep it false)
  barHeight?: number;
  rowGapPx?: number;      // vertical space between the two timelines
  topColor?: string;      // canonical color
  bottomColor?: string;   // user color
  showLegend?: boolean;   // optional tiny legend "Target / You"
};

type Props = GlyphsModeProps | TimelineModeProps | CompareModeProps;

/**
 * buildCanonicalElements
 * ----------------------
 * Turns either:
 *  - a single "char" (preferred) into canonical Morse elements, or
 *  - a raw ".-." pattern string into elements (fallback)
 *
 * We insert INTRA_CHAR_GAP_UNITS between elements inside a character so that
 * the timeline spacing reflects proper intra-character gaps.
 */
function buildCanonicalElements(
  char?: string | null,
  morse?: string | null,
  dashUnits: number = DEFAULT_DASH_UNITS
): MorseElement[] {
  if (char && char.trim()) {
    const ch = char.trim().slice(0, 1);
    return textToMorseElements(ch, dashUnits);
  }
  const raw = (morse ?? '').trim();
  if (!raw) return [];
  const tokens = [...raw];
  const el: MorseElement[] = [];
  tokens.forEach((tok, idx) => {
    el.push({
      kind: tok === '.' ? 'dot' : 'dash',
      units: tok === '.' ? 1 : dashUnits,
    } as MorseElement);
    if (idx < tokens.length - 1) {
      el.push({ kind: 'gap', units: INTRA_CHAR_GAP_UNITS } as MorseElement);
    }
  });
  return el;
}

export default function RevealBar(props: Props) {
  // Resolve props with sane defaults
  const visible = props.visible;
  const size: Size = props.size ?? 'md';
  const align: Align = props.align ?? 'center';
  const color = props.color ?? colors.blueNeon;
  const mode = (props as any).mode ?? 'glyphs';

  /**
   * Size preset mapping:
   * - glyphSize: dot/dash visual size in "glyphs" mode
   * - gapPx: visual gap between glyphs in "glyphs" mode
   * - dashRatio: dash width multiplier relative to dot (usually 3)
   * - minH: minimum reserved height so layout doesn't jump when hidden
   * - unitPxDefault: default pixel-per-unit for timeline bars
   * - barHeightDefault: default timeline bar thickness
   * - legendFontSize: compact legend typography
   */
  const { glyphSize, gapPx, dashRatio, minH, unitPxDefault, barHeightDefault, legendFontSize } =
    React.useMemo(() => {
      switch (size) {
        case 'sm': return { glyphSize: 10, gapPx: 5, dashRatio: 3, minH: 14, unitPxDefault: 9,  barHeightDefault: 10, legendFontSize: 10 };
        case 'lg': return { glyphSize: 16, gapPx: 7, dashRatio: 3, minH: 26, unitPxDefault: 12, barHeightDefault: 14, legendFontSize: 12 };
        default:   return { glyphSize: 12, gapPx: 6, dashRatio: 3, minH: 18, unitPxDefault: 10, barHeightDefault: 12, legendFontSize: 11 };
      }
    }, [size]);

  // Alignment for the outer slot content ("center" or "flex-start")
  const alignItems = align === 'center' ? 'center' : 'flex-start';

  // Prepare glyph-mode pattern (string like ".-.-")
  const glyphPattern = mode === 'glyphs' ? (props as GlyphsModeProps).morse?.trim() ?? '' : '';

  // Pull timeline-related props only when in timeline/compare modes
  const tlChar = (mode === 'timeline' || mode === 'compare') ? (props as TimelineModeProps | CompareModeProps).char : undefined;
  const tlMorse = (mode === 'timeline' || mode === 'compare') ? (props as TimelineModeProps | CompareModeProps).morse : undefined;
  const tlWpm   = (mode === 'timeline' || mode === 'compare') ? ((props as any).wpm ?? 12) : 12;
  const tlDashUnits = (mode === 'timeline' || mode === 'compare') ? ((props as any).dashUnits ?? DEFAULT_DASH_UNITS) : DEFAULT_DASH_UNITS;
  const tlUnitPx = (mode === 'timeline' || mode === 'compare') ? ((props as any).unitPx ?? unitPxDefault) : unitPxDefault;
  const tlBarHeight = (mode === 'timeline' || mode === 'compare') ? ((props as any).barHeight ?? barHeightDefault) : barHeightDefault;
  const tlShowGaps = (mode === 'timeline' || mode === 'compare') ? ((props as any).showGaps ?? true) : true;

  // Compare-only styling/props (legend + colors + vertical spacing)
  const cmpPresses = mode === 'compare' ? (props as CompareModeProps).presses ?? [] : [];
  const cmpRowGapPx = mode === 'compare' ? ((props as CompareModeProps).rowGapPx ?? 6) : 6;
  const cmpTopColor = mode === 'compare' ? ((props as CompareModeProps).topColor ?? colors.blueNeon) : colors.blueNeon;
  const cmpBottomColor = mode === 'compare' ? ((props as CompareModeProps).bottomColor ?? '#FFD235') : '#FFD235';
  const cmpShowLegend = mode === 'compare' ? !!(props as CompareModeProps).showLegend : false;

  // Canonical (target) elements are derived once per prop change; cheap + stable
  const canonicalElements = React.useMemo<MorseElement[]>(() => {
    if (mode === 'timeline' || mode === 'compare') {
      return buildCanonicalElements(tlChar, tlMorse, tlDashUnits);
    }
    return [];
  }, [mode, tlChar, tlMorse, tlDashUnits]);

  /**
   * Convert user presses into timeline elements:
   * - We bucket durations by "granularity" to avoid jitter in the UI while
   *   remaining faithful to measured timings. Here we use 4 (finer than canonical).
   * - unitMs is derived from current WPM so the user timeline scales identically.
   */
  const inputElements = React.useMemo<MorseElement[]>(() => {
    if (mode === 'compare') {
      const unitMs = unitMsFromWpm(tlWpm);
      return pressesToElementsWithGaps(cmpPresses, unitMs, 16);
    }
    return [];
  }, [mode, cmpPresses, tlWpm]);

  return (
    <View style={[styles.slot, { minHeight: minH, alignItems }]}>
      {/* We keep the same vertical space reserved and just flip opacity via "visible"
          to avoid layout jumps when toggling the compare block. */}
      <View style={{ opacity: visible ? 1 : 0, alignSelf: 'stretch', alignItems: 'center' }}>
        {/* --- 1) GLYPHS MODE ------------------------------------------------ */}
        {mode === 'glyphs' && (
          glyphPattern.length > 0 ? (
            <MorseGlyphRow
              pattern={glyphPattern}
              size={glyphSize}
              dashRatio={dashRatio} // dash width multiplier (3x dot by default)
              gapPx={gapPx}         // pixel gap between glyph elements
              color={color}
            />
          ) : (
            // Keep height so the card doesn't jump if pattern is empty
            <View style={{ height: glyphSize }} />
          )
        )}

        {/* --- 2) TIMELINE MODE ---------------------------------------------- */}
        {mode === 'timeline' && (
          canonicalElements.length > 0 ? (
            <MorseTimeline
              // Canonical row driven by element list (dot/dash + intra gaps)
              source={{ mode: 'elements', elements: canonicalElements }}
              unitPx={tlUnitPx}              // pixels per dot-unit
              height={tlBarHeight}           // bar thickness
              color={color}                  // single-accent color
              inactiveColor="rgba(255,255,255,0.2)" // faint background for gaps
              showGaps={tlShowGaps}          // render gaps visibly or just as spacing
              rounded                        // rounded line caps look friendlier
              granularity={1}                // canonical is exact (no bucketing)
            />
          ) : (
            // Empty spacer to keep layout consistent when no canonical exists
            <View style={{ height: tlBarHeight }} />
          )
        )}

        {/* --- 3) COMPARE MODE ----------------------------------------------- */}
        {mode === 'compare' && (
          <>
            {/* Optional mini-legend: compact labels for target vs you */}
            {cmpShowLegend && (
              <View style={[styles.legendRow, { marginBottom: 4 }]}>
                <View style={[styles.legendDot, { backgroundColor: cmpTopColor }]} />
                <Text style={[styles.legendText, { fontSize: legendFontSize }]}>Target</Text>
                <View style={{ width: 12 }} />
                <View style={[styles.legendDot, { backgroundColor: cmpBottomColor }]} />
                <Text style={[styles.legendText, { fontSize: legendFontSize }]}>You</Text>
              </View>
            )}

            {/* Top row: canonical pattern (no explicit gaps drawn; spacing only) */}
            {canonicalElements.length > 0 ? (
              <MorseTimeline
                source={{ mode: 'elements', elements: canonicalElements }}
                unitPx={tlUnitPx}
                height={tlBarHeight}
                color={cmpTopColor}
                inactiveColor="transparent"   // keep clean; no background gray
                showGaps={false}              // gaps invisible but respected in spacing
                rounded
                granularity={1}               // canonical remains exact
              />
            ) : (
              <View style={{ height: tlBarHeight }} />
            )}

            {/* Row spacing between canonical and user timelines */}
            <View style={{ height: cmpRowGapPx }} />

            {/* Bottom row: user's input mapped to elements (bucketing for stability) */}
            {inputElements.length > 0 ? (
              <MorseTimeline
                source={{ mode: 'elements', elements: inputElements }}
                unitPx={tlUnitPx}
                height={tlBarHeight}
                color={cmpBottomColor}
                inactiveColor="transparent"
                showGaps={false}              // user gaps hidden for a smooth look
                rounded
                granularity={4}               // finer resolution to reflect input nuance
              />
            ) : (
              <View style={{ height: tlBarHeight }} />
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { alignSelf: 'stretch', justifyContent: 'flex-start' },

  legendRow: { flexDirection: 'row', alignItems: 'center' },

  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },

  legendText: { color: '#FFFFFFB3', fontWeight: '600' },
});
