import { Platform } from 'react-native';

import { isNativeTorchAvailable, setNativeTorchEnabled } from './nativeTorch';

export type TorchState = 'on' | 'off';

type ExpoTorchModule = {
  ON?: string;
  OFF?: string;
  setStateAsync?: (state: string) => Promise<any>;
};

let ExpoTorch: ExpoTorchModule | undefined;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ExpoTorch = require('expo-torch');
} catch (error) {
  if (__DEV__) {
    console.warn(
      '[torch] expo module unavailable; native torch will be used when available.',
      error,
    );
  }
  ExpoTorch = undefined;
}

const EXPO_ON_STATE = ExpoTorch?.ON ?? 'on';
const EXPO_OFF_STATE = ExpoTorch?.OFF ?? 'off';

type TorchBackend = 'native' | 'expo' | 'none';

let lockCount = 0;
let currentState: TorchState = 'off';
let activeBackend: TorchBackend = 'none';
let pendingExpo: Promise<void> | null = null;

const hasExpoSupport = (): boolean =>
  !!ExpoTorch?.setStateAsync && Platform.OS !== 'web';

const resolveSupportedBackend = (preferFallback = false): TorchBackend => {
  if (Platform.OS === 'android' && isNativeTorchAvailable()) {
    return 'native';
  }
  if (hasExpoSupport()) {
    return 'expo';
  }
  return preferFallback ? activeBackend : 'none';
};

const applyExpoState = async (next: TorchState): Promise<void> => {
  if (!hasExpoSupport()) {
    return;
  }
  if (currentState === next && activeBackend === 'expo') {
    return;
  }
  if (pendingExpo) {
    try {
      await pendingExpo;
    } catch {
      // ignore errors from prior attempts so we can retry
    }
  }
  const operation = ExpoTorch!
    .setStateAsync!(next === 'on' ? EXPO_ON_STATE : EXPO_OFF_STATE)
    .then(() => {
      currentState = next;
      activeBackend = 'expo';
    })
    .catch((error) => {
      activeBackend = 'none';
      currentState = 'off';
      throw error;
    })
    .finally(() => {
      pendingExpo = null;
    });
  pendingExpo = operation;
  await operation;
};

const applyState = async (next: TorchState): Promise<void> => {
  const backend = resolveSupportedBackend(next === 'off');
  if (backend === 'none') {
    if (next === 'off') {
      currentState = 'off';
      activeBackend = 'none';
    }
    return;
  }
  if (backend === 'native') {
    if (currentState === next && activeBackend === 'native') {
      return;
    }
    const success = setNativeTorchEnabled(next === 'on');
    if (success) {
      currentState = next;
      activeBackend = 'native';
      return;
    }
    activeBackend = 'none';
    if (hasExpoSupport()) {
      await applyExpoState(next);
      return;
    }
    throw new Error('Native torch toggle failed');
  }
  await applyExpoState(next);
};

const hasTorchSupport = (): boolean => resolveSupportedBackend(true) !== 'none';

export function isTorchAvailable(): boolean {
  return hasTorchSupport();
}

export async function acquireTorch(): Promise<void> {
  if (!hasTorchSupport()) {
    return;
  }
  lockCount += 1;
  if (lockCount === 1) {
    try {
      await applyState('on');
    } catch (error) {
      lockCount = 0;
      throw error;
    }
  }
}

export async function releaseTorch(): Promise<void> {
  if (!hasTorchSupport()) {
    return;
  }
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
  if (!hasTorchSupport()) {
    return;
  }
  lockCount = 0;
  await applyState('off');
}

export async function forceTorchOff(): Promise<void> {
  if (!hasTorchSupport() && activeBackend === 'none') {
    return;
  }
  if (pendingExpo) {
    try {
      await pendingExpo;
    } catch {
      // best effort: prior errors do not block the force-off attempt
    }
  }
  const backend = activeBackend !== 'none' ? activeBackend : resolveSupportedBackend(true);
  if (backend === 'native') {
    const success = setNativeTorchEnabled(false);
    if (!success) {
      activeBackend = 'none';
      if (!hasExpoSupport()) {
        throw new Error('Unable to force native torch off');
      }
      await applyExpoState('off');
    } else {
      currentState = 'off';
      activeBackend = 'native';
    }
    lockCount = 0;
    return;
  }
  if (backend === 'expo') {
    await applyExpoState('off');
    lockCount = 0;
    return;
  }
  currentState = 'off';
  activeBackend = 'none';
  lockCount = 0;
}
