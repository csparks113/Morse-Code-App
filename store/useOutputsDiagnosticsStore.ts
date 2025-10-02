import { create } from 'zustand';

import { isTorchAvailable } from '@/utils/torch';

type TorchPulsePayload = {
  latencyMs: number;
  source: string;
};

type TorchFailurePayload = {
  reason: string;
  source?: string;
};

type TorchDiagnosticsState = {
  torchSupported: boolean;
  torchPulseCount: number;
  totalLatencyMs: number;
  lastLatencyMs: number | null;
  lastPulseAt: number | null;
  lastPulseSource: string | null;
  torchFailureCount: number;
  lastFailureAt: number | null;
  lastFailureReason: string | null;
  lastFailureSource: string | null;
  setTorchSupported: (supported: boolean) => void;
  recordTorchPulse: (payload: TorchPulsePayload) => void;
  recordTorchFailure: (payload: TorchFailurePayload) => void;
  resetTorchMetrics: () => void;
};

const initialMetrics = {
  torchPulseCount: 0,
  totalLatencyMs: 0,
  lastLatencyMs: null,
  lastPulseAt: null,
  lastPulseSource: null,
  torchFailureCount: 0,
  lastFailureAt: null,
  lastFailureReason: null,
  lastFailureSource: null,
} as const;

export const useOutputsDiagnosticsStore = create<TorchDiagnosticsState>((set) => ({
  torchSupported: isTorchAvailable(),
  ...initialMetrics,
  setTorchSupported: (supported) => {
    set((state) => {
      if (state.torchSupported === supported) {
        if (!supported) {
          return state;
        }
        if (state.torchFailureCount === 0) {
          return state;
        }
      }

      if (supported) {
        return {
          ...state,
          torchSupported: true,
          torchFailureCount: 0,
          lastFailureAt: null,
          lastFailureReason: null,
          lastFailureSource: null,
        };
      }

      return {
        ...state,
        torchSupported: false,
      };
    });
  },
  recordTorchPulse: ({ latencyMs, source }) => {
    const clampedLatency = Math.max(0, latencyMs);
    const roundedLatency = Math.round(clampedLatency);
    const now = Date.now();
    set((state) => ({
      torchPulseCount: state.torchPulseCount + 1,
      totalLatencyMs: state.totalLatencyMs + clampedLatency,
      lastLatencyMs: roundedLatency,
      lastPulseAt: now,
      lastPulseSource: source,
    }));
  },
  recordTorchFailure: ({ reason, source }) => {
    const now = Date.now();
    set((state) => ({
      torchFailureCount: state.torchFailureCount + 1,
      lastFailureAt: now,
      lastFailureReason: reason,
      lastFailureSource: source ?? null,
    }));
  },
  resetTorchMetrics: () => {
    set((state) => ({
      ...state,
      ...initialMetrics,
    }));
  },
}));

export function updateTorchSupport(supported: boolean): void {
  const state = useOutputsDiagnosticsStore.getState();
  if (state.torchSupported === supported) {
    if (!supported || state.torchFailureCount === 0) {
      return;
    }
  }

  state.setTorchSupported(supported);
}

export function recordTorchPulse(latencyMs: number, source: string): void {
  useOutputsDiagnosticsStore.getState().recordTorchPulse({ latencyMs, source });
}

export function recordTorchFailure(reason: string, source?: string): void {
  useOutputsDiagnosticsStore.getState().recordTorchFailure({ reason, source });
}

export function resetTorchDiagnostics(): void {
  useOutputsDiagnosticsStore.getState().resetTorchMetrics();
}

export function getTorchAverageLatency(): number | null {
  const state = useOutputsDiagnosticsStore.getState();
  if (state.torchPulseCount === 0) {
    return null;
  }
  const avg = state.totalLatencyMs / state.torchPulseCount;
  return Math.round(avg);
}