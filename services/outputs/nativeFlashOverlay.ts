import { NativeModules, Platform } from 'react-native';

type FlashOverlayNativeModule = {
  setFlashOverlayStateSync?: (enabled: boolean, brightnessPercent: number) => boolean;
  setScreenBrightnessBoostSync?: (enabled: boolean) => void;
  getOverlayAvailabilityDebugStringSync?: () => string;
};

const isAndroid = Platform.OS === 'android';

let hasLoggedMissingModule = false;

const resolveNativeModule = (): FlashOverlayNativeModule | undefined => {
  if (!isAndroid) {
    return undefined;
  }
  const dispatcher = NativeModules.NativeOutputsDispatcher as FlashOverlayNativeModule | undefined;
  if (dispatcher && typeof dispatcher.setFlashOverlayStateSync === 'function') {
    hasLoggedMissingModule = false;
    return dispatcher;
  }
  const module = NativeModules.FlashOverlayModule as FlashOverlayNativeModule | undefined;
  if (module && typeof module.setFlashOverlayStateSync === 'function') {
    hasLoggedMissingModule = false;
    return module;
  }
  if (!hasLoggedMissingModule) {
    console.warn('[outputs] FlashOverlayModule unavailable; native overlay disabled.');
    hasLoggedMissingModule = true;
  }
  return undefined;
};

export const isNativeFlashOverlayModuleAvailable = (): boolean => resolveNativeModule() != null;

const clampBrightnessPercent = (value: number) => {
  const numeric = Number.isFinite(value) ? value : 0;
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(numeric)));
};

export function setNativeFlashOverlayState(enabled: boolean, brightnessPercent: number): boolean {
  const module = resolveNativeModule();
  if (!module?.setFlashOverlayStateSync) {
    return false;
  }
  try {
    const clamped = clampBrightnessPercent(brightnessPercent);
    return module.setFlashOverlayStateSync(enabled, clamped) === true;
  } catch {
    return false;
  }
}

export function setNativeScreenBrightnessBoost(enabled: boolean) {
  const module = resolveNativeModule();
  if (!module?.setScreenBrightnessBoostSync) {
    return;
  }
  try {
    module.setScreenBrightnessBoostSync(enabled);
  } catch {
    // ignore
  }
}

export function getNativeOverlayDebugString(): string | null {
  const module = resolveNativeModule();
  if (!module?.getOverlayAvailabilityDebugStringSync) {
    return null;
  }
  try {
    const value = module.getOverlayAvailabilityDebugStringSync();
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}
