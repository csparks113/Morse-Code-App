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
};

type GlyphsModeProps = BaseProps & {
  mode?: 'glyphs';
  morse?: string | null;
  color?: string;
  gapPx?: number;
  dashRatio?: number;
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
  color?: string;
};

type CompareModeProps = BaseProps & {
  mode: 'compare';
  char?: string | null;
  morse?: string | null;
  presses: PressWindow[];
  wpm?: number;
  dashUnits?: number;
  unitPx?: number;
  barHeight?: number;
  rowGapPx?: number;
  topColor?: string;
  bottomColor?: string;
  showLegend?: boolean;
};

type RevealBarProps = GlyphsModeProps | TimelineModeProps | CompareModeProps;

const SIZE_CONFIG: Record<Size, { glyphSize: number; glyphGap: number; timelineHeight: number }> = {
  sm: { glyphSize: 10, glyphGap: 6, timelineHeight: 10 },
  md: { glyphSize: 12, glyphGap: 8, timelineHeight: 12 },
  lg: { glyphSize: 14, glyphGap: 10, timelineHeight: 14 },
};

const EMPTY_ELEMENTS: MorseElement[] = [];
const EMPTY_PRESSES: PressWindow[] = [];

function buildCanonicalElements(
  char?: string | null,
  morse?: string | null,
  dashUnits: number = DEFAULT_DASH_UNITS,
): MorseElement[] {
  if (char && char.trim()) {
    return textToMorseElements(char.trim().slice(0, 1), dashUnits);
  }
  const raw = (morse ?? '').trim();
  if (!raw) return EMPTY_ELEMENTS;

  const elements: MorseElement[] = [];
  [...raw].forEach((tok, index) => {
    elements.push({
      kind: tok === '.' ? 'dot' : 'dash',
      units: tok === '.' ? 1 : dashUnits,
    } as MorseElement);
    if (index < raw.length - 1) {
      elements.push({ kind: 'gap', units: INTRA_CHAR_GAP_UNITS } as MorseElement);
    }
  });
  return elements;
}

export default function RevealBar(props: RevealBarProps) {
  const mode = props.mode ?? 'glyphs';
  const size = props.size ?? 'md';
  const align = props.align ?? 'center';
  const sizeConfig = SIZE_CONFIG[size];
  const alignItems: 'flex-start' | 'center' = align === 'left' ? 'flex-start' : 'center';

  const baseSlotStyle = [
    styles.slot,
    {
      alignItems,
      minHeight: sizeConfig.timelineHeight + 24,
      opacity: props.visible ? 1 : 0,
    },
  ];

  const glyphProps = mode === 'glyphs' ? (props as GlyphsModeProps) : undefined;
  const timelineProps = mode === 'timeline' ? (props as TimelineModeProps) : undefined;
  const compareProps = mode === 'compare' ? (props as CompareModeProps) : undefined;

  const dashUnits = timelineProps?.dashUnits ?? compareProps?.dashUnits ?? DEFAULT_DASH_UNITS;
  const unitPx = timelineProps?.unitPx ?? compareProps?.unitPx ?? sizeConfig.timelineHeight;
  const barHeight = timelineProps?.barHeight ?? compareProps?.barHeight ?? sizeConfig.timelineHeight;
  const canonicalChar = timelineProps?.char ?? compareProps?.char ?? null;
  const canonicalMorse = timelineProps?.morse ?? compareProps?.morse ?? null;

  const canonicalElements = React.useMemo(() => {
    if (mode === 'timeline' || mode === 'compare') {
      return buildCanonicalElements(canonicalChar, canonicalMorse, dashUnits);
    }
    return EMPTY_ELEMENTS;
  }, [mode, canonicalChar, canonicalMorse, dashUnits]);

  const comparePresses = compareProps?.presses ?? EMPTY_PRESSES;
  const compareWpm = compareProps?.wpm ?? 12;

  const userElements = React.useMemo(() => {
    if (mode !== 'compare' || comparePresses.length === 0) {
      return EMPTY_ELEMENTS;
    }
    const unitMs = unitMsFromWpm(compareWpm);
    return pressesToElementsWithGaps(comparePresses, unitMs, 16);
  }, [mode, comparePresses, compareWpm]);

  if (glyphProps) {
    const { morse, color = colors.text, gapPx = sizeConfig.glyphGap, dashRatio = 3 } = glyphProps;
    const pattern = (morse ?? '').trim();

    if (!pattern) {
      return <View style={baseSlotStyle} />;
    }

    return (
      <View style={baseSlotStyle}>
        <MorseGlyphRow
          pattern={pattern}
          size={sizeConfig.glyphSize}
          dashRatio={dashRatio}
          gapPx={gapPx}
          color={color}
        />
      </View>
    );
  }

  if (mode === 'timeline') {
    const color = timelineProps?.color ?? colors.blueNeon;
    const showGaps = timelineProps?.showGaps ?? true;

    return (
      <View style={baseSlotStyle}>
        {canonicalElements.length > 0 ? (
          <MorseTimeline
            source={{ mode: 'elements', elements: canonicalElements }}
            unitPx={unitPx}
            height={barHeight}
            color={color}
            inactiveColor={showGaps ? 'rgba(255,255,255,0.2)' : 'transparent'}
            showGaps={showGaps}
            rounded
            granularity={1}
          />
        ) : (
          <View style={{ height: barHeight }} />
        )}
      </View>
    );
  }

  const rowGapPx = compareProps?.rowGapPx ?? 6;
  const topColor = compareProps?.topColor ?? colors.blueNeon;
  const bottomColor = compareProps?.bottomColor ?? colors.gold;
  const showLegend = compareProps?.showLegend ?? false;

  return (
    <View style={baseSlotStyle}>
      {showLegend && (
        <View style={[styles.legendRow, { marginBottom: 4 }]}>
          <View style={[styles.legendDot, { backgroundColor: topColor }]} />
          <Text style={styles.legendText}>Target</Text>
          <View style={{ width: 12 }} />
          <View style={[styles.legendDot, { backgroundColor: bottomColor }]} />
          <Text style={styles.legendText}>You</Text>
        </View>
      )}

      {canonicalElements.length > 0 ? (
        <MorseTimeline
          source={{ mode: 'elements', elements: canonicalElements }}
          unitPx={unitPx}
          height={barHeight}
          color={topColor}
          inactiveColor='transparent'
          showGaps={false}
          rounded
          granularity={1}
        />
      ) : (
        <View style={{ height: barHeight }} />
      )}

      <View style={{ height: rowGapPx }} />

      {userElements.length > 0 ? (
        <MorseTimeline
          source={{ mode: 'elements', elements: userElements }}
          unitPx={unitPx}
          height={barHeight}
          color={bottomColor}
          inactiveColor='transparent'
          showGaps={false}
          rounded
          granularity={4}
        />
      ) : (
        <View style={{ height: barHeight }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { alignSelf: 'stretch', justifyContent: 'flex-start' },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { color: colors.text, fontWeight: '600' },
});
