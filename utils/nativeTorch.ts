import { NativeModules, Platform } from 'react-native';

type NativeTorchModule = {
  setTorchEnabledSync?: (enabled: boolean) => boolean;
  isTorchAvailableSync?: () => boolean;
};

const MODULE_NAME = 'TorchModule';

let loggedMissingModule = false;

const resolveNativeTorchModule = (warnOnMissing = false): NativeTorchModule | null => {
  if (Platform.OS !== 'android') {
    return null;
  }
  const module = NativeModules[MODULE_NAME] as NativeTorchModule | undefined;
  if (
    module &&
    typeof module.setTorchEnabledSync === 'function' &&
    typeof module.isTorchAvailableSync === 'function'
  ) {
    loggedMissingModule = false;
    return module;
  }
  if (warnOnMissing && __DEV__ && !loggedMissingModule) {
    console.warn('[torch] native TorchModule unavailable; falling back to JS module.');
    loggedMissingModule = true;
  }
  return null;
};

export const isNativeTorchModuleAvailable = (): boolean =>
  resolveNativeTorchModule(false) != null;

export const isNativeTorchAvailable = (): boolean => {
  const module = resolveNativeTorchModule(false);
  if (!module?.isTorchAvailableSync) {
    return false;
  }
  try {
    return module.isTorchAvailableSync() === true;
  } catch {
    return false;
  }
};

export const setNativeTorchEnabled = (enabled: boolean): boolean => {
  const module = resolveNativeTorchModule(true);
  if (!module?.setTorchEnabledSync) {
    return false;
  }
  try {
    return module.setTorchEnabledSync(enabled) === true;
  } catch (error) {
    if (__DEV__) {
      console.warn('[torch] native torch toggle failed', error);
    }
    return false;
  }
};
