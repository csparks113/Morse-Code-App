import { Platform } from 'react-native';

export type TorchState = 'on' | 'off';

type TorchModuleType = {
  ON?: string;
  OFF?: string;
  setStateAsync?: (state: string) => Promise<any>;
};

let TorchModule: TorchModuleType | undefined;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  TorchModule = require('expo-torch');
} catch (error) {
  if (__DEV__) {
    console.warn('[torch] native module unavailable; torch output disabled', error);
  }
  TorchModule = undefined;
}

const ON_STATE = TorchModule?.ON ?? 'on';
const OFF_STATE = TorchModule?.OFF ?? 'off';

let lockCount = 0;
let currentState: TorchState = 'off';
let pending: Promise<void> | null = null;

function hasNativeSupport(): boolean {
  return !!TorchModule?.setStateAsync && Platform.OS !== 'web';
}

async function applyState(next: TorchState): Promise<void> {
  if (!hasNativeSupport()) return;
  if (currentState === next) return;

  if (pending) {
    try {
      await pending;
    } catch {
      // ignore previous failure
    }
  }

  const operation = TorchModule!
    .setStateAsync!(next === 'on' ? ON_STATE : OFF_STATE)
    .then(() => {
      currentState = next;
    })
    .catch(() => {
      currentState = 'off';
    })
    .finally(() => {
      pending = null;
    });

  pending = operation;
  await operation;
}

export function isTorchAvailable(): boolean {
  return hasNativeSupport();
}

export async function acquireTorch(): Promise<void> {
  if (!hasNativeSupport()) return;
  lockCount += 1;
  if (lockCount === 1) {
    await applyState('on');
  }
}

export async function releaseTorch(): Promise<void> {
  if (!hasNativeSupport()) return;
  if (lockCount === 0) {
    await applyState('off');
    return;
  }
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    await applyState('off');
  }
}

export async function resetTorch(): Promise<void> {
  if (!hasNativeSupport()) return;
  lockCount = 0;
  await applyState('off');
}

export async function forceTorchOff(): Promise<void> {
  if (!hasNativeSupport()) return;

  if (pending) {
    try {
      await pending;
    } catch {
      // ignore errors from in-flight operation
    }
  }

  const operation = TorchModule!
    .setStateAsync!(OFF_STATE)
    .then(() => {
      currentState = 'off';
    })
    .catch((error) => {
      currentState = 'off';
      throw error;
    })
    .finally(() => {
      pending = null;
    });

  pending = operation;
  await operation;
}
