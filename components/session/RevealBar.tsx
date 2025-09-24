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

type Size = 'sm' | 'md' | 'lg';
type Align = 'center' | 'left';

type BaseProps = {
  visible: boolean;
  size?: Size;
  align?: Align;
  color?: string;
};

type GlyphsModeProps = BaseProps & {
  mode?: 'glyphs';
  morse?: string | null;
};

type TimelineModeProps = BaseProps & {
  mode: 'timeline';
  char?: string | null;
  morse?: string | null;
  wpm?: number;
  dashUnits?: number;
  unitPx?: number;
  showGaps?: boolean;
  barHeight?: number;
};

type CompareModeProps = BaseProps & {
  mode: 'compare';
  char?: string | null;
  morse?: string | null;
  presses: PressWindow[];
  wpm?: number;
  dashUnits?: number;
  unitPx?: number;
  showGaps?: boolean;   // for canonical row
  barHeight?: number;
  rowGapPx?: number;
  topColor?: string;
  bottomColor?: string;
  showLegend?: boolean;
};

type Props = GlyphsModeProps | TimelineModeProps | CompareModeProps;

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
  const visible = props.visible;
  const size: Size = props.size ?? 'md';
  const align: Align = props.align ?? 'center';
  const color = props.color ?? colors.blueNeon;
  const mode = (props as any).mode ?? 'glyphs';

  const { glyphSize, gapPx, dashRatio, minH, unitPxDefault, barHeightDefault, legendFontSize } =
    React.useMemo(() => {
      switch (size) {
        case 'sm': return { glyphSize: 10, gapPx: 5, dashRatio: 3, minH: 14, unitPxDefault: 9,  barHeightDefault: 10, legendFontSize: 10 };
        case 'lg': return { glyphSize: 16, gapPx: 7, dashRatio: 3, minH: 26, unitPxDefault: 12, barHeightDefault: 14, legendFontSize: 12 };
        default:   return { glyphSize: 12, gapPx: 6, dashRatio: 3, minH: 18, unitPxDefault: 10, barHeightDefault: 12, legendFontSize: 11 };
      }
    }, [size]);

  const alignItems = align === 'center' ? 'center' : 'flex-start';

  const glyphPattern = mode === 'glyphs' ? (props as GlyphsModeProps).morse?.trim() ?? '' : '';

  const tlChar = (mode === 'timeline' || mode === 'compare') ? (props as TimelineModeProps | CompareModeProps).char : undefined;
  const tlMorse = (mode === 'timeline' || mode === 'compare') ? (props as TimelineModeProps | CompareModeProps).morse : undefined;
  const tlWpm   = (mode === 'timeline' || mode === 'compare') ? ((props as any).wpm ?? 12) : 12;
  const tlDashUnits = (mode === 'timeline' || mode === 'compare') ? ((props as any).dashUnits ?? DEFAULT_DASH_UNITS) : DEFAULT_DASH_UNITS;
  const tlUnitPx = (mode === 'timeline' || mode === 'compare') ? ((props as any).unitPx ?? unitPxDefault) : unitPxDefault;
  const tlBarHeight = (mode === 'timeline' || mode === 'compare') ? ((props as any).barHeight ?? barHeightDefault) : barHeightDefault;
  const tlShowGaps = (mode === 'timeline' || mode === 'compare') ? ((props as any).showGaps ?? true) : true;

  const cmpPresses = mode === 'compare' ? (props as CompareModeProps).presses ?? [] : [];
  const cmpRowGapPx = mode === 'compare' ? ((props as CompareModeProps).rowGapPx ?? 6) : 6;
  const cmpTopColor = mode === 'compare' ? ((props as CompareModeProps).topColor ?? colors.blueNeon) : colors.blueNeon;
  const cmpBottomColor = mode === 'compare' ? ((props as CompareModeProps).bottomColor ?? '#FFD235') : '#FFD235';
  const cmpShowLegend = mode === 'compare' ? !!(props as CompareModeProps).showLegend : false;

  const canonicalElements = React.useMemo<MorseElement[]>(() => {
    if (mode === 'timeline' || mode === 'compare') {
      return buildCanonicalElements(tlChar, tlMorse, tlDashUnits);
    }
    return [];
  }, [mode, tlChar, tlMorse, tlDashUnits]);

  const inputElements = React.useMemo<MorseElement[]>(() => {
    if (mode === 'compare') {
      const unitMs = unitMsFromWpm(tlWpm);
      return pressesToElementsWithGaps(cmpPresses, unitMs, 4);
    }
    return [];
  }, [mode, cmpPresses, tlWpm]);

  return (
    <View style={[styles.slot, { minHeight: minH, alignItems }]}>
      <View style={{ opacity: visible ? 1 : 0, alignSelf: 'stretch', alignItems: 'center' }}>
        {mode === 'glyphs' && (
          glyphPattern.length > 0 ? (
            <MorseGlyphRow
              pattern={glyphPattern}
              size={glyphSize}
              dashRatio={dashRatio}
              gapPx={gapPx}
              color={color}
            />
          ) : (
            <View style={{ height: glyphSize }} />
          )
        )}

        {mode === 'timeline' && (
          canonicalElements.length > 0 ? (
            <MorseTimeline
              source={{ mode: 'elements', elements: canonicalElements }}
              wpm={tlWpm}
              unitPx={tlUnitPx}
              height={tlBarHeight}
              color={color}
              inactiveColor="rgba(255,255,255,0.2)"
              showGaps={tlShowGaps}
              rounded
              granularity={1}
            />
          ) : (
            <View style={{ height: tlBarHeight }} />
          )
        )}

        {mode === 'compare' && (
          <>
            {cmpShowLegend && (
              <View style={[styles.legendRow, { marginBottom: 4 }]}>
                <View style={[styles.legendDot, { backgroundColor: cmpTopColor }]} />
                <Text style={[styles.legendText, { fontSize: legendFontSize }]}>Target</Text>
                <View style={{ width: 12 }} />
                <View style={[styles.legendDot, { backgroundColor: cmpBottomColor }]} />
                <Text style={[styles.legendText, { fontSize: legendFontSize }]}>You</Text>
              </View>
            )}

            {canonicalElements.length > 0 ? (
              <MorseTimeline
                source={{ mode: 'elements', elements: canonicalElements }}
                wpm={tlWpm}
                unitPx={tlUnitPx}
                height={tlBarHeight}
                color={cmpTopColor}
                inactiveColor="transparent"   // ← no gray gap
                showGaps={false}              // ← gaps invisible but spaced
                rounded
                granularity={1}
              />
            ) : (
              <View style={{ height: tlBarHeight }} />
            )}

            <View style={{ height: cmpRowGapPx }} />

            {inputElements.length > 0 ? (
              <MorseTimeline
                source={{ mode: 'elements', elements: inputElements }}
                wpm={tlWpm}
                unitPx={tlUnitPx}
                height={tlBarHeight}
                color={cmpBottomColor}
                inactiveColor="transparent"
                showGaps={false}              // inputs: gaps invisible
                rounded
                granularity={4}               // finer resolution for input
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
  slot: { alignSelf: 'stretch', justifyContent: 'center'},

  legendRow: { flexDirection: 'row', alignItems: 'center' },

  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },

  legendText: { color: '#FFFFFFB3', fontWeight: '600' },
});
