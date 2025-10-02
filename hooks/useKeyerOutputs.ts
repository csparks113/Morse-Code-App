import React from 'react';
import type { Animated } from 'react-native';

import { useOutputsService } from '@/services/outputs/OutputsService';

type UseKeyerOutputsOptions = {
  audioEnabled: boolean;
  hapticsEnabled: boolean;
  lightEnabled: boolean;
  torchEnabled: boolean;
  toneHz: number;
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

export function useKeyerOutputs(options: UseKeyerOutputsOptions): UseKeyerOutputsResult {
  const outputs = useOutputsService();
  const stableOptions = useStableOptions(options);

  const serviceRef = React.useRef(outputs);
  const handleRef = React.useRef(outputs.createKeyerOutputs(stableOptions));
  const prevOptionsRef = React.useRef(stableOptions);

  if (serviceRef.current !== outputs) {
    handleRef.current.teardown().catch(() => {});
    serviceRef.current = outputs;
    handleRef.current = outputs.createKeyerOutputs(stableOptions);
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