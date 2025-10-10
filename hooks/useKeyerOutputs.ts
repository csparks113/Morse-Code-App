import React from 'react';
import { AppState } from 'react-native';
import type { Animated } from 'react-native';

import { createPressTracker, type PressTracker } from '@/services/latency/pressTracker';
import { useOutputsService } from '@/services/outputs/OutputsService';

type UseKeyerOutputsOptions = {
  audioEnabled: boolean;
  hapticsEnabled: boolean;
  lightEnabled: boolean;
  torchEnabled: boolean;
  toneHz: number;
  audioVolumePercent: number;
  flashBrightnessPercent: number;
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
  cutActiveOutputs: (reason?: string, metadata?: Record<string, string | number | boolean>) => void;
};

function useStableOptions(options: UseKeyerOutputsOptions): UseKeyerOutputsOptions {
  return React.useMemo(
    () => ({
      audioEnabled: options.audioEnabled,
      hapticsEnabled: options.hapticsEnabled,
      lightEnabled: options.lightEnabled,
      torchEnabled: options.torchEnabled,
      toneHz: options.toneHz,
      audioVolumePercent: options.audioVolumePercent,
      flashBrightnessPercent: options.flashBrightnessPercent,
    }),
    [
      options.audioEnabled,
      options.hapticsEnabled,
      options.lightEnabled,
      options.torchEnabled,
      options.toneHz,
      options.audioVolumePercent,
      options.flashBrightnessPercent,
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
  const isPressingRef = React.useRef(false);
  const watchdogRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (watchdogRef.current) {
        clearTimeout(watchdogRef.current);
        watchdogRef.current = null;
      }
      isPressingRef.current = false;
      handleRef.current.teardown().catch(() => {});
    };
  }, []);

  const scheduleWatchdog = React.useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
    }
    watchdogRef.current = setTimeout(() => {
      handleRef.current.cutActiveOutputs('watchdog.timeout');
      isPressingRef.current = false;
    }, 1800);
  }, []);

  const onDown = React.useCallback((timestampMs?: number) => {
    isPressingRef.current = true;
    handleRef.current.pressStart(timestampMs);
    scheduleWatchdog();
  }, [scheduleWatchdog]);

  const onUp = React.useCallback((timestampMs?: number) => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    isPressingRef.current = false;
    handleRef.current.pressEnd(timestampMs);
  }, []);

  const prepare = React.useCallback(() => {
    return handleRef.current.prepare();
  }, []);

  const teardown = React.useCallback(() => {
    return handleRef.current.teardown();
  }, []);

  const cutActiveOutputs = React.useCallback((reason?: string, metadata?: Record<string, string | number | boolean>) => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
    isPressingRef.current = false;
    handleRef.current.cutActiveOutputs(reason, metadata);
  }, []);

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        cutActiveOutputs('appstate.change', { state: nextState });
      }
    });
    return () => sub.remove();
  }, [cutActiveOutputs]);

  return React.useMemo(
    () => ({
      onDown,
      onUp,
      flashOpacity: handleRef.current.flashOpacity,
      prepare,
      teardown,
      cutActiveOutputs,
    }),
    [onDown, onUp, prepare, teardown, cutActiveOutputs],
  );
}










