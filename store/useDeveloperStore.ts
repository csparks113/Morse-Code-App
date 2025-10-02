import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  setDeveloperMode: (enabled: boolean) => void;
  setOutputsTracingEnabled: (enabled: boolean) => void;
  appendTrace: (entry: Omit<OutputsTraceEntry, 'id'>) => void;
  clearTraces: () => void;
};

const TRACE_BUFFER_SIZE = 200;

export const useDeveloperStore = create<DeveloperState>()(
  persist(
    (set, get) => ({
      developerMode: false,
      outputsTracingEnabled: false,
      traces: [],
      nextTraceId: 1,
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
    }),
    {
      name: 'developer-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        developerMode: state.developerMode,
        outputsTracingEnabled: state.outputsTracingEnabled,
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
