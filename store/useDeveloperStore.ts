import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { KeyerOutputsOptions } from '@/services/outputs/OutputsService';

export type OutputsTraceEntry = {
  id: number;
  event: string;
  timestamp: number;
  wallClock: number;
  payload?: Record<string, unknown>;
};

type DeveloperState = {
  developerMode: boolean;
  outputsTracingEnabled: boolean;
  traces: OutputsTraceEntry[];
  nextTraceId: number;
  manualTriggers: KeyerOutputsOptions;
  manualPattern: string;
  manualWpm: number;
  setDeveloperMode: (enabled: boolean) => void;
  setOutputsTracingEnabled: (enabled: boolean) => void;
  appendTrace: (entry: Omit<OutputsTraceEntry, 'id'>) => void;
  clearTraces: () => void;
  setManualTriggers: (partial: Partial<KeyerOutputsOptions>) => void;
  setManualPattern: (pattern: string) => void;
  setManualWpm: (wpm: number) => void;
};

const TRACE_BUFFER_SIZE = 200;
const DEFAULT_PATTERN = '... --- ...';
const DEFAULT_WPM = 10;

const createDefaultManualTriggers = (): KeyerOutputsOptions => ({
  audioEnabled: true,
  hapticsEnabled: true,
  lightEnabled: true,
  torchEnabled: false,
  toneHz: 600,
  audioVolumePercent: 100,
  flashBrightnessPercent: 80,
});

export const useDeveloperStore = create<DeveloperState>()(
  persist(
    (set, get) => ({
      developerMode: false,
      outputsTracingEnabled: false,
      traces: [],
      nextTraceId: 1,
      manualTriggers: createDefaultManualTriggers(),
      manualPattern: DEFAULT_PATTERN,
      manualWpm: DEFAULT_WPM,
      setDeveloperMode: (enabled) => {
        set((state) => {
          if (enabled) {
            return {
              developerMode: true,
              outputsTracingEnabled: state.outputsTracingEnabled,
            };
          }

          return {
            developerMode: false,
            outputsTracingEnabled: false,
            traces: [],
            nextTraceId: 1,
            manualTriggers: createDefaultManualTriggers(),
            manualPattern: DEFAULT_PATTERN,
            manualWpm: DEFAULT_WPM,
          };
        });
      },
      setOutputsTracingEnabled: (enabled) => {
        set((state) => ({
          outputsTracingEnabled: enabled,
          developerMode: enabled ? true : state.developerMode,
          ...(enabled
            ? {}
            : {
                traces: [],
                nextTraceId: 1,
              }),
        }));
      },
      appendTrace: (entry) => {
        const state = get();
        if (!state.outputsTracingEnabled) {
          return;
        }

        set((current) => {
          if (!current.outputsTracingEnabled) {
            return {};
          }

          const id = current.nextTraceId;
          const nextEntry: OutputsTraceEntry = { ...entry, id };
          const source = current.traces;

          let traces: OutputsTraceEntry[];
          if (source.length >= TRACE_BUFFER_SIZE) {
            traces = [...source.slice(source.length - TRACE_BUFFER_SIZE + 1), nextEntry];
          } else {
            traces = [...source, nextEntry];
          }

          return {
            traces,
            nextTraceId: id + 1,
          };
        });
      },
      clearTraces: () => set({ traces: [], nextTraceId: 1 }),
      setManualTriggers: (partial) => {
        set((state) => ({
          manualTriggers: { ...state.manualTriggers, ...partial },
        }));
      },
      setManualPattern: (pattern) => {
        set({ manualPattern: pattern || DEFAULT_PATTERN });
      },
      setManualWpm: (wpm) => {
        set({ manualWpm: Number.isFinite(wpm) && wpm > 0 ? wpm : DEFAULT_WPM });
      },
    }),
    {
      name: 'developer-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        developerMode: state.developerMode,
        outputsTracingEnabled: state.outputsTracingEnabled,
        manualTriggers: state.manualTriggers,
        manualPattern: state.manualPattern,
        manualWpm: state.manualWpm,
      }),
    },
  ),
);

export function isOutputsTracingEnabled(): boolean {
  const state = useDeveloperStore.getState();
  return state.developerMode && state.outputsTracingEnabled;
}

export function getOutputsTraceBuffer(): OutputsTraceEntry[] {
  return useDeveloperStore.getState().traces;
}

export const outputsTraceBufferSize = TRACE_BUFFER_SIZE;

