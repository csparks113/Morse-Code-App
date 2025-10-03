import React from 'react';
import type { Animated } from 'react-native';

import { createPressTracker, type PressTracker } from '@/services/latency/pressTracker';
import { useOutputsService } from '@/services/outputs/OutputsService';

type UseKeyerOutputsOptions = {
  audioEnabled: boolean;
  hapticsEnabled: boolean;
  lightEnabled: boolean;
  torchEnabled: boolean;
  toneHz: number;
};

type UseKeyerOutputsMetadata = {
  source?: string;
  pressTracker?: PressTracker;
};

type UseKeyerOutputsResult = {
  onDown: (timestampMs?: number) => void;
  onUp: (timestampMs?: number) => void;
  flashOpacity: Animated.Value;
  prepare: () => Promise<void>;
  teardown: () => Promise<void>;
};

function useStableOptions(options: UseKeyerOutputsOptions): UseKeyerOutputsOptions {
  return React.useMemo(
    () => ({
      audioEnabled: options.audioEnabled,
      hapticsEnabled: options.hapticsEnabled,
      lightEnabled: options.lightEnabled,
      torchEnabled: options.torchEnabled,
      toneHz: options.toneHz,
    }),
    [
      options.audioEnabled,
      options.hapticsEnabled,
      options.lightEnabled,
      options.torchEnabled,
      options.toneHz,
    ],
  );
}

export function useKeyerOutputs(
  options: UseKeyerOutputsOptions,
  metadata?: UseKeyerOutputsMetadata,
): UseKeyerOutputsResult {
  const outputs = useOutputsService();
  const stableOptions = useStableOptions(options);
  const source = metadata?.source ?? 'session.keyer';

  const pressTracker = React.useMemo(
    () => metadata?.pressTracker ?? createPressTracker(source),
    [metadata?.pressTracker, source],
  );

  const serviceRef = React.useRef(outputs);
  const sourceRef = React.useRef(source);
  const trackerRef = React.useRef(pressTracker);
  const handleRef = React.useRef(
    outputs.createKeyerOutputs(stableOptions, { source, pressTracker }),
  );
  const prevOptionsRef = React.useRef(stableOptions);

  if (
    serviceRef.current !== outputs ||
    sourceRef.current !== source ||
    trackerRef.current !== pressTracker
  ) {
    handleRef.current.teardown().catch(() => {});
    serviceRef.current = outputs;
    sourceRef.current = source;
    trackerRef.current = pressTracker;
    handleRef.current = outputs.createKeyerOutputs(stableOptions, { source, pressTracker });
    prevOptionsRef.current = stableOptions;
  } else if (prevOptionsRef.current !== stableOptions) {
    handleRef.current.updateOptions(stableOptions);
    prevOptionsRef.current = stableOptions;
  }

  React.useEffect(() => {
    return () => {
      handleRef.current.teardown().catch(() => {});
    };
  }, []);

  const onDown = React.useCallback((timestampMs?: number) => {
    handleRef.current.pressStart(timestampMs);
  }, []);

  const onUp = React.useCallback((timestampMs?: number) => {
    handleRef.current.pressEnd(timestampMs);
  }, []);

  const prepare = React.useCallback(() => {
    return handleRef.current.prepare();
  }, []);

  const teardown = React.useCallback(() => {
    return handleRef.current.teardown();
  }, []);

  return React.useMemo(
    () => ({
      onDown,
      onUp,
      flashOpacity: handleRef.current.flashOpacity,
      prepare,
      teardown,
    }),
    [onDown, onUp, prepare, teardown],
  );
}
