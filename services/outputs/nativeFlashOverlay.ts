import { NativeModules, NativeEventEmitter, Platform, EmitterSubscription } from 'react-native';

type FlashOverlayNativeModule = {
  setFlashOverlayStateSync?: (enabled: boolean, brightnessPercent: number) => boolean;
  setFlashOverlayAppearanceSync?: (brightnessPercent: number, colorArgb: number) => boolean;
  setFlashOverlayOverrideSync?: (brightnessPercent: number | null, colorArgb: number | null) => boolean;
  setScreenBrightnessBoostSync?: (enabled: boolean) => void;
  getOverlayAvailabilityDebugStringSync?: () => string;
};

const isAndroid = Platform.OS === 'android';

let hasLoggedMissingModule = false;

const resolveNativeModule = (warnOnMissing = false): FlashOverlayNativeModule | undefined => {
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
  if (warnOnMissing && !hasLoggedMissingModule) {
    console.warn('[outputs] FlashOverlayModule unavailable; native overlay disabled.');
    hasLoggedMissingModule = true;
  }
  return undefined;
};

export const isNativeFlashOverlayModuleAvailable = (): boolean => resolveNativeModule() != null;

const clampPulsePercent = (value: number) => {
  const numeric = Number.isFinite(value) ? value : 0;
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(numeric)));
};

export function setNativeFlashOverlayState(enabled: boolean, brightnessPercent: number): boolean {
  const module = resolveNativeModule(true);
  if (!module?.setFlashOverlayStateSync) {
    return false;
  }
  try {
    const clamped = clampPulsePercent(brightnessPercent);
    return module.setFlashOverlayStateSync(enabled, clamped) === true;
  } catch {
    return false;
  }
}

const clampAppearanceBrightnessPercent = (value: number) => {
  const numeric = Number.isFinite(value) ? value : 0;
  if (!Number.isFinite(numeric)) {
    return BRIGHTNESS_PERCENT_DEFAULT;
  }
  return Math.max(BRIGHTNESS_PERCENT_FLOOR, Math.min(BRIGHTNESS_PERCENT_CEIL, Math.round(numeric)));
};

export const BRIGHTNESS_PERCENT_FLOOR = 25;
export const BRIGHTNESS_PERCENT_CEIL = 100;
export const BRIGHTNESS_PERCENT_DEFAULT = 80;
export const APPEARANCE_EVENT = 'flashAppearanceApplied';
export type FlashAppearanceEvent = {
  brightnessPercent: number;
  brightnessScalar: number;
  tintColor: number;
  source: string;
  viewApplied: boolean;
  reapplyCount: number;
  frameJankSuspected?: boolean;
};

let appearanceEmitter: NativeEventEmitter | null = null;

const getAppearanceEmitter = (): NativeEventEmitter | null => {
  if (!isAndroid) {
    return null;
  }
  if (appearanceEmitter) {
    return appearanceEmitter;
  }
  const nativeModule =
    (NativeModules.NativeOutputsDispatcher as FlashOverlayNativeModule | undefined) ??
    (NativeModules.FlashOverlayModule as FlashOverlayNativeModule | undefined);
  if (!nativeModule) {
    return null;
  }
  appearanceEmitter = new NativeEventEmitter(nativeModule as unknown as Record<string, unknown>);
  return appearanceEmitter;
};

export function setNativeFlashOverlayAppearance(brightnessPercent: number, colorArgb: number): boolean {
  const module = resolveNativeModule(false);
  if (!module?.setFlashOverlayAppearanceSync) {
    return false;
  }
  try {
    const clampedPercent = clampAppearanceBrightnessPercent(brightnessPercent);
    return module.setFlashOverlayAppearanceSync(clampedPercent, colorArgb >>> 0) === true;
  } catch {
    return false;
  }
}

export function setNativeFlashOverlayOverride(
  brightnessPercent: number | null | undefined,
  colorArgb: number | null | undefined,
): boolean {
  const module = resolveNativeModule(false);
  if (!module?.setFlashOverlayOverrideSync) {
    return false;
  }
  try {
    const nextPercent =
      brightnessPercent == null ? null : clampAppearanceBrightnessPercent(brightnessPercent);
    const tint = colorArgb == null ? null : (colorArgb >>> 0);
    return module.setFlashOverlayOverrideSync(nextPercent, tint) === true;
  } catch {
    return false;
  }
}

export function addFlashAppearanceListener(
  listener: (event: FlashAppearanceEvent) => void,
): EmitterSubscription {
  const emitter = getAppearanceEmitter();
  if (!emitter) {
    return {
      remove: () => {},
    } as EmitterSubscription;
  }
  return emitter.addListener(APPEARANCE_EVENT, listener);
}

export function setNativeScreenBrightnessBoost(enabled: boolean) {
  const module = resolveNativeModule(true);
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
  const module = resolveNativeModule(true);
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
