export type NumericLimit = {
  min: number;
  max: number;
  step: number;
};

export const SETTINGS_DEFAULTS = {
  receiveOnly: false,
  audioEnabled: true,
  lightEnabled: false,
  torchEnabled: false,
  hapticsEnabled: true,
  wpm: 12,
  toneHz: 600,
  audioVolumePercent: 80,
  flashBrightnessPercent: 80,
  signalTolerancePercent: 30,
  gapTolerancePercent: 50,
  flashOffsetMs: 0,
  hapticOffsetMs: 0,
} as const;

export const SETTINGS_LIMITS: Record<
  'wpm' |
    'toneHz' |
    'audioVolumePercent' |
    'flashBrightnessPercent' |
    'signalTolerancePercent' |
    'gapTolerancePercent' |
    'flashOffsetMs' |
    'hapticOffsetMs',
  NumericLimit
> = {
  wpm: { min: 5, max: 60, step: 1 },
  toneHz: { min: 200, max: 1200, step: 10 },
  audioVolumePercent: { min: 0, max: 100, step: 5 },
  flashBrightnessPercent: { min: 0, max: 100, step: 5 },
  signalTolerancePercent: { min: 20, max: 60, step: 5 },
  gapTolerancePercent: { min: 30, max: 80, step: 5 },
  flashOffsetMs: { min: -300, max: 300, step: 5 },
  hapticOffsetMs: { min: -300, max: 300, step: 5 },
};

export type SettingsLimitKey = keyof typeof SETTINGS_LIMITS;

export const LESSON_CONFIG = {
  send: {
    totalQuestions: 5,
    verdictBufferMs: 200,
  },
} as const;

export const APP_CONFIG = {
  settings: {
    defaults: SETTINGS_DEFAULTS,
    limits: SETTINGS_LIMITS,
  },
  lessons: LESSON_CONFIG,
} as const;

export const TOTAL_SEND_QUESTIONS = LESSON_CONFIG.send.totalQuestions;
export const DEFAULT_VERDICT_BUFFER_MS = LESSON_CONFIG.send.verdictBufferMs;

export function clampSettingValue(key: SettingsLimitKey, value: number): number {
  const limit = SETTINGS_LIMITS[key];
  const safe = Number.isFinite(value) ? value : limit.min;
  return Math.max(limit.min, Math.min(limit.max, safe));
}

export function applySettingStep(key: SettingsLimitKey, value: number, direction: -1 | 0 | 1): number {
  const limit = SETTINGS_LIMITS[key];
  const stepped = value + direction * limit.step;
  return clampSettingValue(key, stepped);
}

