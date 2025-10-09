type AudioApiModule = typeof import('react-native-audio-api');

let audioApiModule: AudioApiModule | null = null;
let audioApiModuleLoaded = false;
let expoAudioModule: any | null = null;
let expoAudioLoaded = false;

function loadAudioApi(): AudioApiModule | null {
  if (audioApiModuleLoaded) {
    return audioApiModule;
  }
  audioApiModuleLoaded = true;
  if (Platform.OS === 'web') {
    audioApiModule = null;
    return audioApiModule;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    audioApiModule = require('react-native-audio-api');
  } catch (error) {
    audioApiModule = null;
  }
  return audioApiModule;
}

async function ensureExpoAudioModule(): Promise<any | null> {
  if (expoAudioLoaded) {
    return expoAudioModule;
  }
  expoAudioLoaded = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    expoAudioModule = require('expo-audio');
  } catch (error) {
    expoAudioModule = null;
  }
  return expoAudioModule;
}

// utils/audio.ts
// Ultra-low-latency Morse audio
// - Web: WebAudio oscillator + gain envelope for near-instant start
// - Native (iOS/Android): expo-audio with preloaded tones, replayAsync(), pre-warm, and ping-pong players

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { AudioContext as AudioApiContext, GainNode as AudioApiGainNode, OscillatorNode as AudioApiOscillatorNode } from 'react-native-audio-api';
import type { OutputsAudio, PlaybackSymbol } from '@/outputs-native/audio.nitro';
import { nowMs } from '@/utils/time';


type NitroModulesExports = typeof import('react-native-nitro-modules');

let nitroModules: NitroModulesExports | null = null;
let nitroModulesAttempted = false;

function loadNitroModules(): NitroModulesExports | null {
  if (nitroModulesAttempted) {
    return nitroModules;
  }
  nitroModulesAttempted = true;
  if (Platform.OS === 'web') {
    nitroModules = null;
    return nitroModules;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    nitroModules = require('react-native-nitro-modules') as NitroModulesExports;
  } catch (error) {
    if (__DEV__ && !(error instanceof Error && error.name === 'ModuleNotFoundError')) {
      console.warn('Nitro modules unavailable:', error);
    }
    nitroModules = null;
  }
  return nitroModules;
}

let outputsAudioModule: OutputsAudio | null = null;
let outputsAudioLoaded = false;
let outputsAudioLoadLogged = false;
let outputsAudioPreferenceLogged = false;

const nitroProcessEnv = ((globalThis as any)?.process?.env ?? {}) as Record<string, string | undefined>;
const disableNitroOutputsEnv = nitroProcessEnv?.EXPO_DISABLE_NITRO_OUTPUTS;
const forceNitroOutputsEnv = nitroProcessEnv?.EXPO_FORCE_NITRO_OUTPUTS;

const runtimeNitroOutputsFlag = (() => {
  const flags = (globalThis as any)?.__morseFeatureFlags;
  const value = flags?.nitroOutputs;
  if (typeof value === 'boolean') {
    return value;
  }
  if (value && typeof value === 'object') {
    if (typeof value.enabled === 'boolean') {
      return value.enabled;
    }
    if (typeof value.prefer === 'boolean') {
      return value.prefer;
    }
  }
  return null;
})();

type NitroPreference = {
  enabled: boolean;
  reason: 'platform' | 'forced' | 'env-disabled' | 'runtime' | 'default';
};

let cachedNitroPreference: NitroPreference | null = null;

const isTruthy = (value?: string) => {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

function evaluateNitroPreference(): NitroPreference {
  if (Platform.OS !== 'android') {
    return { enabled: false, reason: 'platform' };
  }
  if (isTruthy(forceNitroOutputsEnv)) {
    return { enabled: true, reason: 'forced' };
  }
  if (isTruthy(disableNitroOutputsEnv)) {
    return { enabled: false, reason: 'env-disabled' };
  }
  if (runtimeNitroOutputsFlag != null) {
    return { enabled: runtimeNitroOutputsFlag, reason: 'runtime' };
  }
  return { enabled: true, reason: 'default' };
}

function getNitroPreference(): NitroPreference {
  if (!cachedNitroPreference) {
    cachedNitroPreference = evaluateNitroPreference();
  }
  return cachedNitroPreference;
}

function shouldPreferNitroOutputs(): boolean {
  return getNitroPreference().enabled;
}

function loadOutputsAudio(): OutputsAudio | null {
  if (outputsAudioLoaded) {
    return outputsAudioModule;
  }
  outputsAudioLoaded = true;

  const preference = getNitroPreference();
  if (!preference.enabled) {
    outputsAudioModule = null;
    if (__DEV__ && !outputsAudioPreferenceLogged) {
      outputsAudioPreferenceLogged = true;
      console.log('[outputs-audio] nitro.disabled', { reason: preference.reason });
    }
    return outputsAudioModule;
  }

  const nitro = loadNitroModules();
  if (!nitro) {
    if (__DEV__ && !outputsAudioLoadLogged) {
      outputsAudioLoadLogged = true;
      console.warn('OutputsAudio Nitro module unavailable: base Nitrogen loader missing');
    }
    outputsAudioModule = null;
    return outputsAudioModule;
  }
  const { NitroModules, ModuleNotFoundError } = nitro;
  const moduleNotFoundCtor =
    typeof ModuleNotFoundError === 'function' ? ModuleNotFoundError : null;
  try {
    const instance = NitroModules.createHybridObject<OutputsAudio>('OutputsAudio');
    if (instance?.isSupported?.() === true) {
      outputsAudioModule = instance;
    } else {
      if (__DEV__ && !outputsAudioLoadLogged) {
        outputsAudioLoadLogged = true;
        console.warn('OutputsAudio Nitro module reported unsupported hardware; falling back.');
      }
      outputsAudioModule = null;
    }
  } catch (error) {
    const isExpectedModuleMissing = moduleNotFoundCtor
      ? error instanceof moduleNotFoundCtor
      : false;
    if (__DEV__ && !isExpectedModuleMissing && !outputsAudioLoadLogged) {
      outputsAudioLoadLogged = true;
      console.warn('OutputsAudio Nitro module initialization failed:', error);
    }
    outputsAudioModule = null;
  }
  return outputsAudioModule;
}

// Shared settings
import { useSettingsStore } from '../store/useSettingsStore';
import { toMorse } from './morse';

export function getMorseUnitMs(): number {
  const { wpm } = (useSettingsStore.getState() as any) || { wpm: 20 };
  return Math.max(20, Math.round(1200 / Math.max(5, Number(wpm) || 20)));
}

export type NativeSymbolTimingContext = {
  nativeTimestampMs: number | null;
  nativeDurationMs: number | null;
  nativeSequence: number | null;
  nativeOffsetMs: number | null;
};

export type PlayOpts = {
  onSymbolStart?: (symbol: '.' | '-', durationMs: number, native?: NativeSymbolTimingContext) => void;
  onSymbolEnd?: (symbol: '.' | '-', durationMs: number) => void;
  onGap?: (gapMs: number) => void;
  hz?: number;
  unitMsOverride?: number;
};

// ---------------------------------------------------------------------------
// WEB PATH: WebAudio
// ---------------------------------------------------------------------------
let webCtx: AudioContext | null = null as any;
let webGain: GainNode | null = null as any;
let webOsc: OscillatorNode | null = null as any;
let webCancel = 0;

function ensureWeb(hz: number) {
  if (!webCtx) {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    webCtx = new Ctor();
  }
  if (!webGain) {
    webGain = webCtx!.createGain();
    webGain.gain.value = 0;
    webGain.connect(webCtx!.destination);
  }
  if (!webOsc) {
    webOsc = webCtx!.createOscillator();
    webOsc.type = 'sine';
    webOsc.frequency.setValueAtTime(hz, webCtx!.currentTime);
    webOsc.connect(webGain!);
    webOsc.start();
  } else {
    webOsc.frequency.setValueAtTime(hz, webCtx!.currentTime);
  }
}

async function playMorseCodeWeb(code: string, unitMsArg?: number, opts: PlayOpts = {}) {
  const token = ++webCancel;
  const { toneHz } = (useSettingsStore.getState() as any) || { toneHz: 600 };
  const unitMs = Math.max(10, Math.floor(unitMsArg ?? getMorseUnitMs()));
  const hz = Math.max(100, Math.min(2000, Math.floor(opts.hz ?? toneHz ?? 600)));
  ensureWeb(hz);
  await webCtx!.resume();

  for (let i = 0; i < code.length; i++) {
    if (token !== webCancel) return;
    const sym = code[i] as '.' | '-';
    if (sym !== '.' && sym !== '-') {
      const gap = unitMs * 3;
      opts.onGap?.(gap);
      await sleep(gap);
      continue;
    }
    const dur = sym === '.' ? unitMs : unitMs * 3;
    opts.onSymbolStart?.(sym, dur);
    // instant start via gain envelope
    webGain!.gain.cancelScheduledValues(webCtx!.currentTime);
    webGain!.gain.setValueAtTime(0, webCtx!.currentTime);
    webGain!.gain.linearRampToValueAtTime(1, webCtx!.currentTime + 0.005);    await sleep(dur);
    if (token !== webCancel) {
      // stop
      webGain!.gain.cancelScheduledValues(webCtx!.currentTime);
      webGain!.gain.linearRampToValueAtTime(0, webCtx!.currentTime + 0.003);      opts.onSymbolEnd?.(sym, dur);
      if (i < code.length - 1) {
        const gap = unitMs;
        opts.onGap?.(gap);
        await sleep(gap);
      }
    }
  }
}

function stopPlaybackWeb() {
  webCancel++;
  if (webGain && webCtx) {
    webGain.gain.cancelScheduledValues(webCtx.currentTime);
    webGain.gain.setValueAtTime(0, webCtx.currentTime);
  }
}

// ---------------------------------------------------------------------------
// NATIVE PATH: react-native-audio-api
// ---------------------------------------------------------------------------

let audioApiContext: AudioApiContext | null = null;
let audioApiGain: AudioApiGainNode | null = null;
let audioApiOsc: AudioApiOscillatorNode | null = null;
let audioApiToken = 0;
let audioApiConfigured = false;

async function configureAudioApiSession(audioApi: AudioApiModule) {
  if (audioApiConfigured) {
    return;
  }
  try {
    await audioApi.AudioManager.setAudioSessionActivity(true);
    audioApi.AudioManager.setAudioSessionOptions({
      iosCategory: 'playback',
      iosOptions: ['mixWithOthers', 'allowBluetooth', 'allowBluetoothA2DP', 'defaultToSpeaker'],
    });
    audioApi.AudioManager.observeAudioInterruptions(true);
  } catch (error) {
    // ignore configuration failures
  }
  if (__DEV__) {
    console.log('[audio-api] session.configure');
  }
  audioApiConfigured = true;
}

function ensureAudioApiGraph(audioApi: AudioApiModule, hz: number): boolean {
  if (!audioApiContext) {
    audioApiContext = new audioApi.AudioContext({ initSuspended: true });
  }
  if (!audioApiGain) {
    audioApiGain = audioApiContext.createGain();
    audioApiGain.gain.value = 0;
    audioApiGain.connect(audioApiContext.destination);
  }
  if (!audioApiOsc) {
    audioApiOsc = audioApiContext.createOscillator();
    audioApiOsc.type = 'sine';
    audioApiOsc.frequency.setValueAtTime(hz, audioApiContext.currentTime);
    audioApiOsc.connect(audioApiGain);
    audioApiOsc.start();
  } else {
    audioApiOsc.frequency.setValueAtTime(hz, audioApiContext.currentTime);
  }
  return true;
}

async function playMorseCodeAudioApi(code: string, unitMsArg?: number, opts: PlayOpts = {}) {
  const audioApi = loadAudioApi();
  if (!audioApi) {
    return playMorseCodeExpoNative(code, unitMsArg, opts);
  }

  const { toneHz } = (useSettingsStore.getState() as any) || { toneHz: 600 };
  const unitMs = Math.max(10, Math.floor(unitMsArg ?? getMorseUnitMs()));
  const hz = Math.max(100, Math.min(2000, Math.floor(opts.hz ?? toneHz ?? 600)));

  await configureAudioApiSession(audioApi);
  if (!ensureAudioApiGraph(audioApi, hz) || !audioApiContext || !audioApiGain) {
    return playMorseCodeExpoNative(code, unitMsArg, opts);
  }

  await audioApiContext.resume();
  const token = ++audioApiToken;

  for (let i = 0; i < code.length; i += 1) {
    if (token !== audioApiToken) {
      return;
    }
    const sym = code[i] as '.' | '-';
    if (sym !== '.' && sym !== '-') {
      const gap = unitMs * 3;
      opts.onGap?.(gap);
      await sleep(gap);
      continue;
    }

    const duration = sym === '.' ? unitMs : unitMs * 3;
    opts.onSymbolStart?.(sym, duration);
    audioApiGain.gain.cancelScheduledValues(audioApiContext.currentTime);
    audioApiGain.gain.setValueAtTime(0, audioApiContext.currentTime);
    audioApiGain.gain.linearRampToValueAtTime(1, audioApiContext.currentTime + 0.005);

    await sleep(duration);

    if (token !== audioApiToken) {
      return;
    }

    audioApiGain.gain.cancelScheduledValues(audioApiContext.currentTime);
    audioApiGain.gain.linearRampToValueAtTime(0, audioApiContext.currentTime + 0.003);
    opts.onSymbolEnd?.(sym, duration);

    if (i < code.length - 1) {
      const gap = unitMs;
      opts.onGap?.(gap);
      await sleep(gap);
    }
  }
}

function stopPlaybackAudioApi() {
  audioApiToken += 1;
  if (audioApiContext && audioApiGain) {
    audioApiGain.gain.cancelScheduledValues(audioApiContext.currentTime);
    audioApiGain.gain.setValueAtTime(0, audioApiContext.currentTime);
  }
}

// ---------------------------------------------------------------------------
// FALLBACK NATIVE PATH: expo-audio
// ---------------------------------------------------------------------------

let expoNativeToken = 0;
let dotA: any = null;
let dotB: any = null;
let dashA: any = null;
let dashB: any = null;
let cachedFreq = -1;
let cachedUnit = -1;

async function configureExpoAudio(): Promise<void> {
  const expo = await ensureExpoAudioModule();
  if (!expo) {
    return;
  }

  const { Audio, InterruptionModeAndroid, InterruptionModeIOS } = expo;

  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      interruptionModeAndroid: InterruptionModeAndroid?.DoNotMix ?? 0,
      interruptionModeIOS: InterruptionModeIOS?.DoNotMix ?? 0,
      playThroughEarpieceAndroid: false,
    });
  } catch (error) {
    // ignore configuration errors from expo-audio fallback
  }
}

export async function configureAudio(): Promise<void> {
  if (shouldPreferNitroOutputs()) {
    const outputsAudio = loadOutputsAudio();
    if (outputsAudio) {
      const { toneHz } = (useSettingsStore.getState() as any) || { toneHz: NITRO_DEFAULT_TONE_HZ };
      const resolvedHz = Number.isFinite(toneHz)
        ? Math.max(100, Math.min(2000, Math.floor(toneHz)))
        : NITRO_DEFAULT_TONE_HZ;
      outputsAudio.warmup({ toneHz: resolvedHz });
      return;
    }
  }

  const audioApi = loadAudioApi();
  if (audioApi) {
    await configureAudioApiSession(audioApi);
    return;
  }
  await configureExpoAudio();
}

function genSinePCM(durationMs: number, freqHz: number): Uint8Array {
  const SAMPLE_RATE = 44100;
  const totalSamples = Math.max(1, Math.floor((durationMs / 1000) * SAMPLE_RATE));
  const pcm = new Int16Array(totalSamples);
  const rampSamples = Math.min(totalSamples, Math.floor((5 / 1000) * SAMPLE_RATE));
  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    const s = Math.sin(2 * Math.PI * freqHz * t);
    let amp = s;
    if (i < rampSamples) amp *= i / rampSamples;
    else if (i > totalSamples - rampSamples) amp *= (totalSamples - i) / rampSamples;
    pcm[i] = Math.max(-1, Math.min(1, amp)) * 0.9 * 32767;
  }
  // WAV header
  const bytesPerSample = 2, channels = 1, sampleRate = 44100;
  const byteRate = sampleRate * channels * bytesPerSample;
  const dataSize = pcm.length * bytesPerSample;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  let off = 0;
  function ws(s: string) { for (let i=0;i<s.length;i++) view.setUint8(off++, s.charCodeAt(i)); }
  ws('RIFF'); view.setUint32(off, 36 + dataSize, true); off += 4;
  ws('WAVE'); ws('fmt ');
  view.setUint32(off, 16, true); off += 4; // PCM chunk
  view.setUint16(off, 1, true); off += 2; // PCM
  view.setUint16(off, channels, true); off += 2;
  view.setUint32(off, sampleRate, true); off += 4;
  view.setUint32(off, byteRate, true); off += 4;
  view.setUint16(off, channels * bytesPerSample, true); off += 2;
  view.setUint16(off, 16, true); off += 2;
  ws('data'); view.setUint32(off, dataSize, true); off += 4;
  let o = 44;
  for (let i=0;i<pcm.length;i++) { view.setInt16(o, pcm[i], true); o+=2; }
  return new Uint8Array(buf);
}

// Base64 without external deps
function btoaPolyfill(input: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = input, output = '';
  for (let block = 0, charCode: number, i = 0, map = chars;
       str.charAt(i | 0) || (map = '=', i % 1);
       output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))) {
    charCode = str.charCodeAt(i += 3/4);
    if (charCode > 0xFF) throw new Error('btoa polyfill: invalid character');
    block = (block << 8) | charCode;
  }
  return output;
}

function u8ToBase64(u8: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) {
    const sub = u8.subarray(i, i + CHUNK);
    binary += String.fromCharCode.apply(null, Array.from(sub) as any);
  }
  return (globalThis as any).btoa ? (globalThis as any).btoa(binary) : btoaPolyfill(binary);
}

async function ensureNativeTones(freqHz: number, unitMs: number) {
  const expo = await ensureExpoAudioModule();
  if (!expo) {
    return;
  }
  const { Audio } = expo;
  if (freqHz === cachedFreq && unitMs === cachedUnit && dotA && dotB && dashA && dashB) return;

  const base = `${FileSystem.cacheDirectory}mcm_${freqHz}_${unitMs}_`;
  const dotUri = `${base}dot.wav`;
  const dashUri = `${base}dash.wav`;

  const dotWav = genSinePCM(unitMs, freqHz);
  const dashWav = genSinePCM(unitMs * 3, freqHz);

  await FileSystem.writeAsStringAsync(dotUri, u8ToBase64(dotWav), { encoding: (FileSystem as any).EncodingType?.Base64 ?? ('base64' as any) });
  await FileSystem.writeAsStringAsync(dashUri, u8ToBase64(dashWav), { encoding: (FileSystem as any).EncodingType?.Base64 ?? ('base64' as any) });

  // unload old
  for (const s of [dotA, dotB, dashA, dashB]) { try { await s?.unloadAsync(); } catch {} }
  dotA = new Audio.Sound(); dotB = new Audio.Sound();
  dashA = new Audio.Sound(); dashB = new Audio.Sound();
  await dotA.loadAsync({ uri: dotUri }, { shouldPlay: false, isLooping: false, volume: 1.0 }, false);
  await dotB.loadAsync({ uri: dotUri }, { shouldPlay: false, isLooping: false, volume: 1.0 }, false);
  await dashA.loadAsync({ uri: dashUri }, { shouldPlay: false, isLooping: false, volume: 1.0 }, false);
  await dashB.loadAsync({ uri: dashUri }, { shouldPlay: false, isLooping: false, volume: 1.0 }, false);

  // Pre-warm: quick start/stop so the first real play is instant
  try { await dotA.playAsync(); await dotA.stopAsync(); } catch {}
  try { await dashA.playAsync(); await dashA.stopAsync(); } catch {}

  cachedFreq = freqHz;
  cachedUnit = unitMs;
}

// ping-pong players to avoid replay contention
function pickPair(sym: '.' | '-') {
  if (sym === '.') return [dotA, dotB] as const;
  return [dashA, dashB] as const;
}

async function playMorseCodeExpoNative(code: string, unitMsArg?: number, opts: PlayOpts = {}) {
  const my = ++expoNativeToken;
  const { toneHz } = (useSettingsStore.getState() as any) || { toneHz: 600 };
  const unitMs = Math.max(10, Math.floor(unitMsArg ?? getMorseUnitMs()));
  const hz = Math.max(100, Math.min(2000, Math.floor(opts.hz ?? toneHz ?? 600)));

  await configureAudio();
  await ensureNativeTones(hz, unitMs);

  for (let i = 0; i < code.length; i++) {
    if (my !== expoNativeToken) return;
    const sym = code[i] as '.' | '-';
    if (sym !== '.' && sym !== '-') {
      const gap = unitMs * 3;
      opts.onGap?.(gap);
      await sleep(gap);
      continue;
    }
    const dur = sym === '.' ? unitMs : unitMs * 3;
    opts.onSymbolStart?.(sym, dur);
    const [A, B] = pickPair(sym);
    const snd = (i % 2 === 0 ? A : B);
    if (snd) {
      try {
        await snd.setPositionAsync(0);
        // replayAsync is optimized for immediate restarts
        await snd.replayAsync();
      } catch {}
    }
    await sleep(dur);
    try { await snd?.stopAsync(); } catch {}
    opts.onSymbolEnd?.(sym, dur);
    if (i < code.length - 1) {
      const gap = unitMs;
      opts.onGap?.(gap);
      await sleep(gap);
    }
  }
}

type ToneControllerBackend = 'nitro' | 'audio-api' | 'expo' | 'web' | 'noop';

export type ToneController = {
  prepare(hz: number): Promise<void>;
  start(hz?: number): Promise<void>;
  stop(): Promise<void>;
  teardown(): Promise<void>;
  getCurrentHz(): number | null;
  setVolume?(value: number): void;
  backend: ToneControllerBackend;
};

function generateLoopingSineWav(
  frequency: number,
  opts?: { sampleRate?: number; cycles?: number; amplitude?: number },
): Uint8Array {
  const sampleRate = opts?.sampleRate ?? 44100;
  const amplitude = Math.max(0, Math.min(1, opts?.amplitude ?? 0.28));
  const periodSamples = Math.max(1, Math.round(sampleRate / frequency));
  const cycles = opts?.cycles ?? 2000;
  const totalSamples = periodSamples * cycles;

  const bytesPerSample = 2;
  const dataSize = totalSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const rampIn = Math.min(128, Math.floor(totalSamples * 0.002));
  for (let i = 0; i < totalSamples; i += 1) {
    const t = i / sampleRate;
    const s = Math.sin(2 * Math.PI * (sampleRate / periodSamples) * t);
    const env = i < rampIn ? i / rampIn : 1;
    const val = (Math.max(-1, Math.min(1, s)) * amplitude * env * 32767) | 0;
    view.setInt16(offset, val, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

function createWebToneController(): ToneController {
  let ctx: AudioContext | null = null;
  let gain: GainNode | null = null;
  let osc: OscillatorNode | null = null;
  let currentHz: number | null = null;

  const ensureGraph = (hz: number) => {
    if (!ctx) {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
      ctx = Ctor ? new Ctor() : null;
    }
    if (!ctx) {
      return;
    }
    if (!gain) {
      gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
    }
    if (!osc) {
      osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.connect(gain);
      osc.start();
    }
    if (osc) {
      osc.frequency.setValueAtTime(hz, ctx.currentTime);
    }
    currentHz = hz;
  };

  const prepare = async (hz: number) => {
    ensureGraph(hz);
  };

  const start = async (hz?: number) => {
    const target = typeof hz === 'number' ? hz : currentHz ?? 600;
    ensureGraph(target);
    if (!ctx || !gain) {
      return;
    }
    try {
      await ctx.resume();
    } catch {
      // ignore
    }
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.005);
  };

  const stop = async () => {
    if (!ctx || !gain) {
      return;
    }
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.003);
  };

  const teardown = async () => {
    await stop();
    try {
      osc?.stop();
    } catch {
      // ignore
    }
    ctx = null;
    gain = null;
    osc = null;
    currentHz = null;
  };

  return {
    backend: 'web',
    getCurrentHz: () => currentHz,
    prepare,
    start,
    stop,
    teardown,
  };
}

const NITRO_DEFAULT_TONE_HZ = 600;

let nitroPlaybackToken = 0;

function createNitroToneController(outputsAudio: OutputsAudio): ToneController {
  let currentHz: number | null = null;
  let currentGain = 1;
  let appliedGain = 1;
  let toneActive = false;

  const resolveHz = (hz?: number) => {
    if (typeof hz === 'number' && Number.isFinite(hz)) {
      currentHz = hz;
      return hz;
    }
    if (currentHz != null) {
      return currentHz;
    }
    currentHz = NITRO_DEFAULT_TONE_HZ;
    return currentHz;
  };

  const clampGain = (value?: number) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value <= 0) return 0;
      if (value >= 1) return 1;
      return value;
    }
    return 1;
  };

  const applyGainIfActive = () => {
    if (!toneActive) {
      return;
    }
    if (appliedGain === currentGain) {
      return;
    }
    const toneHz = currentHz ?? NITRO_DEFAULT_TONE_HZ;
    currentHz = toneHz;
    try {
      outputsAudio.startTone({ toneHz, gain: currentGain });
      appliedGain = currentGain;
    } catch {
      // ignore
    }
  };

  return {
    backend: 'nitro',
    getCurrentHz: () => currentHz,
    prepare: async (hz: number) => {
      const toneHz = resolveHz(hz);
      outputsAudio.warmup({ toneHz });
    },
    start: async (hz?: number) => {
      const toneHz = resolveHz(hz);
      outputsAudio.startTone({ toneHz, gain: currentGain });
      toneActive = true;
      appliedGain = currentGain;
    },
    setVolume: (value: number) => {
      currentGain = clampGain(value);
      applyGainIfActive();
    },
    stop: async () => {
      toneActive = false;
      outputsAudio.stopTone();
    },
    teardown: async () => {
      toneActive = false;
      outputsAudio.teardown();
      currentHz = null;
      appliedGain = currentGain;
    },
  };
}

async function playMorseCodeNitro(outputsAudio: OutputsAudio, code: string, unitMsArg?: number, opts: PlayOpts = {}) {
  const { toneHz } = (useSettingsStore.getState() as any) || { toneHz: NITRO_DEFAULT_TONE_HZ };
  const unitMs = Math.max(10, Math.floor(unitMsArg ?? getMorseUnitMs()));
  const hz = Math.max(100, Math.min(2000, Math.floor(opts.hz ?? toneHz ?? NITRO_DEFAULT_TONE_HZ)));

  const pattern: PlaybackSymbol[] = [];
  const durations: number[] = [];
  const token = ++nitroPlaybackToken;

  for (let i = 0; i < code.length; i += 1) {
    const symbol = code[i] as PlaybackSymbol | ' ';
    if (symbol === '.' || symbol === '-') {
      const duration = symbol === '.' ? unitMs : unitMs * 3;
      pattern.push(symbol);
      durations.push(duration);
    } else {
      const gap = unitMs * 3;
      opts.onGap?.(gap);
      await sleep(gap);
      if (token !== nitroPlaybackToken) {
        return;
      }
    }
  }

  if (pattern.length === 0) {
    return;
  }

  try {
    outputsAudio.warmup({ toneHz: hz });
    outputsAudio.playMorse({ toneHz: hz, unitMs, pattern });
  } catch (error) {
    if (__DEV__) {
      console.warn('OutputsAudio.playMorse failed, falling back to Audio API:', error);
    }
    await playMorseCodeAudioApi(code, unitMs, opts);
    return;
  }

  const supportsNativeTimeline = typeof (outputsAudio as any).getLatestSymbolInfo === 'function';
  let nativeSequence = 0;
  let nativeOffsetMs: number | null = null;

  const pollNextNativeSymbol = async (): Promise<NativeSymbolTimingContext | null> => {
    if (!supportsNativeTimeline || token !== nitroPlaybackToken) {
      return null;
    }
    const timeoutMs = Math.min(Math.max(unitMs * 2, 150), 400);
    const deadline = nowMs() + timeoutMs;
    while (token === nitroPlaybackToken && nowMs() <= deadline) {
      const payload = (outputsAudio as any).getLatestSymbolInfo?.();
      if (payload) {
        try {
          const info = JSON.parse(payload) as {
            sequence?: number;
            timestampMs?: number;
            durationMs?: number;
          };
          const sequence = typeof info.sequence === 'number' ? info.sequence : null;
          if (sequence != null) {
            if (sequence <= nativeSequence) {
              const resetDetected = sequence <= 1 && nativeSequence > 1;
              if (resetDetected) {
                nativeSequence = 0;
                nativeOffsetMs = null;
                continue;
              }
              continue;
            }
            const jump = sequence - nativeSequence;
            if (jump > 1) {
              if (__DEV__) {
                console.warn('[outputs-audio] native sequence jump', {
                  previous: nativeSequence,
                  next: sequence,
                  delta: jump,
                });
              }
              nativeOffsetMs = null;
            }
            nativeSequence = sequence;
            const timestampMs = typeof info.timestampMs === 'number' ? info.timestampMs : null;
            const durationMs = typeof info.durationMs === 'number' ? info.durationMs : null;
            let offsetMs: number | null = null;
            if (timestampMs != null) {
              offsetMs = nowMs() - timestampMs;
              nativeOffsetMs = offsetMs;
            }
            return {
              nativeTimestampMs: timestampMs,
              nativeDurationMs: durationMs,
              nativeSequence,
              nativeOffsetMs: nativeOffsetMs ?? offsetMs,
            };
          }
        } catch (parseError) {
          if (__DEV__) {
            console.warn('Failed to parse OutputsAudio symbol info:', parseError);
          }
        }
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    return null;
  };

  for (let i = 0; i < pattern.length; i += 1) {
    if (token !== nitroPlaybackToken) {
      return;
    }

    const symbol = pattern[i];
    const duration = durations[i];

    let nativeTiming: NativeSymbolTimingContext | null = null;
    if (supportsNativeTimeline) {
      nativeTiming = await pollNextNativeSymbol();
    }

    opts.onSymbolStart?.(symbol, duration, nativeTiming ?? undefined);

    const nativeTimestampMs = nativeTiming?.nativeTimestampMs ?? null;
    const nativeDurationMs = nativeTiming?.nativeDurationMs != null && nativeTiming.nativeDurationMs > 0
      ? nativeTiming.nativeDurationMs
      : duration;
    const symbolEndTargetMs = nativeTimestampMs != null ? nativeTimestampMs + nativeDurationMs : null;

    if (symbolEndTargetMs != null) {
      const waitMs = symbolEndTargetMs - nowMs();
      if (waitMs > 0) {
        await sleep(waitMs);
      }
    } else {
      await sleep(nativeDurationMs);
    }

    if (token !== nitroPlaybackToken) {
      return;
    }

    opts.onSymbolEnd?.(symbol, duration);

    if (i < pattern.length - 1) {
      const gap = unitMs;
      opts.onGap?.(gap);
      const nextSymbolTargetMs = symbolEndTargetMs != null ? symbolEndTargetMs + gap : null;
      if (nextSymbolTargetMs != null) {
        const gapWaitMs = nextSymbolTargetMs - nowMs();
        if (gapWaitMs > 0) {
          await sleep(gapWaitMs);
        }
      } else {
        await sleep(gap);
      }
      if (token !== nitroPlaybackToken) {
        return;
      }
    }
  }
}
function createAudioApiToneController(audioApi: AudioApiModule): ToneController {
  let ctx: AudioApiContext | null = null;
  let gain: AudioApiGainNode | null = null;
  let osc: AudioApiOscillatorNode | null = null;
  let currentHz: number | null = null;

  const now = () => {
    const perf = (globalThis as any)?.performance;
    return typeof perf?.now === 'function' ? perf.now() : Date.now();
  };

  const logAudioApi = (event: string, payload: Record<string, unknown> = {}) => {
    if (__DEV__) {
      console.log(`[audio-api] ${event}`, payload);
    }
  };

  const ensureGraph = (hz: number) => {
    if (!ctx) {
      ctx = new audioApi.AudioContext({ initSuspended: true });
    }
    if (!gain && ctx) {
      gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
    }
    if (!osc && ctx) {
      osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.connect(gain!);
      osc.start();
    }
    if (osc && ctx) {
      osc.frequency.setValueAtTime(hz, ctx.currentTime);
    }
    currentHz = hz;
  };

  const prepare = async (hz: number) => {
    await configureAudioApiSession(audioApi);
    ensureGraph(hz);
    if (__DEV__) {
      logAudioApi('prepare.graph', { hz, hasContext: !!ctx, hasOsc: !!osc });
    }
    if (ctx) {
      const resumeStartedAt = now();
      try {
        await ctx.resume();
      } catch {
        // ignore
      }
      if (__DEV__) {
        logAudioApi('prepare.resume', {
          hz,
          latencyMs: now() - resumeStartedAt,
        });
      }
    }
  };

  const start = async (hz?: number) => {
    const target = typeof hz === 'number' ? hz : currentHz ?? 600;
    const requestedAt = now();
    const prepareStartedAt = now();
    await prepare(target);
    const preparedAt = now();
    logAudioApi('start.prepare', {
      hz: target,
      latencyMs: preparedAt - prepareStartedAt,
    });
    if (!ctx || !gain) {
      return;
    }
    const resumeStartedAt = now();
    try {
      await ctx.resume();
    } catch {
      // ignore
    }
    const resumedAt = now();
    logAudioApi('start.resume', {
      hz: target,
      latencyMs: resumedAt - resumeStartedAt,
    });
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.005);
    logAudioApi('start.ramp', {
      hz: target,
      totalMs: now() - requestedAt,
    });
  };

  const stop = async () => {
    if (!ctx || !gain) {
      return;
    }
    const stopStartedAt = now();
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.003);
    logAudioApi('stop.ramp', {
      hz: currentHz,
      totalMs: now() - stopStartedAt,
    });
  };

  const teardown = async () => {
    await stop();
    try {
      osc?.stop();
    } catch {
      // ignore
    }
    try {
      await ctx?.suspend?.();
    } catch {
      // ignore
    }
    try {
      await ctx?.close?.();
    } catch {
      // ignore
    }
    ctx = null;
    gain = null;
    osc = null;
    currentHz = null;
  };

  return {
    backend: 'audio-api',
    getCurrentHz: () => currentHz,
    prepare,
    start,
    stop,
    teardown,
  };
}

function createNoopToneController(): ToneController {
  const noop = async () => {};
  return {
    backend: 'noop',
    getCurrentHz: () => null,
    prepare: noop,
    start: noop,
    stop: noop,
    teardown: noop,
  };
}

function createExpoToneController(): ToneController {
  let sound: any = null;
  let preparedHz: number | null = null;
  let preparing: Promise<void> | null = null;
  let expoUnavailable = false;

  const controller: ToneController = {
    backend: 'expo',
    getCurrentHz: () => preparedHz,
    prepare: async (hz: number) => {
      await ensurePrepared(hz);
    },
    start: async (hz?: number) => {
      if (expoUnavailable) {
        return;
      }
      const target = typeof hz === 'number' ? hz : preparedHz ?? 600;
      await ensurePrepared(target);
      if (!sound) {
        return;
      }
      try {
        await sound.setPositionAsync?.(0);
      } catch {
        // ignore
      }
      try {
        await sound.playAsync?.();
      } catch {
        try {
          await sound.replayAsync?.();
        } catch {
          // ignore
        }
      }
    },
    stop: async () => {
      if (!sound) {
        return;
      }
      try {
        await sound.stopAsync?.();
      } catch {
        // ignore
      }
      try {
        await sound.setPositionAsync?.(0);
      } catch {
        // ignore
      }
    },
    teardown: async () => {
      await controller.stop();
      try {
        await sound?.unloadAsync?.();
      } catch {
        // ignore
      }
      sound = null;
      preparedHz = null;
    },
  };

  async function ensurePrepared(hz: number) {
    if (expoUnavailable) {
      return;
    }
    if (sound && preparedHz === hz) {
      return;
    }
    if (preparing) {
      await preparing;
      if (sound && preparedHz === hz) {
        return;
      }
    }
    preparing = (async () => {
      const expo = await ensureExpoAudioModule();
      if (!expo) {
        expoUnavailable = true;
        controller.backend = 'noop';
        sound = null;
        preparedHz = null;
        return;
      }
      await configureExpoAudio();
      if (sound) {
        try {
          await sound.unloadAsync?.();
        } catch {
          // ignore
        }
        sound = null;
      }
      const wav = generateLoopingSineWav(hz, { cycles: 2000, amplitude: 0.28 });
      const base64 = u8ToBase64(wav);
      const dir = `${FileSystem.cacheDirectory ?? ''}morse-keyer/`;
      try {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true } as any);
      } catch {
        // ignore
      }
      const uri = `${dir}keyer_${hz}.wav`;
      await FileSystem.writeAsStringAsync(
        uri,
        base64,
        { encoding: (FileSystem as any).EncodingType?.Base64 ?? ('base64' as any) },
      );
      const created = await expo.Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false, isLooping: true, volume: 1.0 },
        false,
      );
      sound = created.sound;
      preparedHz = hz;
      controller.backend = 'expo';
      try {
        await sound.setIsLoopingAsync?.(true);
      } catch {
        // ignore
      }
    })();
    try {
      await preparing;
    } finally {
      preparing = null;
    }
  }

  return controller;
}

export function createToneController(): ToneController {
  if (Platform.OS === 'web') {
    return createWebToneController();
  }
  const outputsAudio = loadOutputsAudio();
  if (outputsAudio) {
    return createNitroToneController(outputsAudio);
  }
  const audioApi = loadAudioApi();
  if (audioApi) {
    return createAudioApiToneController(audioApi);
  }
  return createExpoToneController();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function playMorseCode(code: string, unitMsArg?: number, opts: PlayOpts = {}) {
  if (Platform.OS === 'web') {
    return playMorseCodeWeb(code, unitMsArg, opts);
  }

  const outputsAudio = shouldPreferNitroOutputs() ? loadOutputsAudio() : null;
  if (outputsAudio) {
    return playMorseCodeNitro(outputsAudio, code, unitMsArg, opts);
  }

  if (loadAudioApi()) {
    return playMorseCodeAudioApi(code, unitMsArg, opts);
  }

  return playMorseCodeExpoNative(code, unitMsArg, opts);
}

export async function playTextAsMorse(text: string, opts: PlayOpts = {}) {
  const unitMs = opts.unitMsOverride ?? getMorseUnitMs();
  const chars = text.split('');
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === ' ') {
      await sleep(unitMs * 7);
      continue;
    }
    const code = toMorse(ch);
    if (!code) continue;
    await playMorseCode(code, unitMs, opts);
    const next = chars[i + 1];
    if (next && next !== ' ') {
      await sleep(unitMs * 3);
    }
  }
}

function stopPlaybackExpo(): void {
  expoNativeToken += 1;
  for (const s of [dotA, dotB, dashA, dashB]) {
    try { s?.stopAsync(); } catch {}
  }
}

export function stopPlayback(): void {
  if (Platform.OS === 'web') {
    stopPlaybackWeb();
    return;
  }

  const outputsAudio = shouldPreferNitroOutputs() ? loadOutputsAudio() : null;
  if (outputsAudio) {
    nitroPlaybackToken += 1;
    try {
      outputsAudio.stopTone();
    } catch {
      // ignore
    }
  }

  if (loadAudioApi()) {
    stopPlaybackAudioApi();
    return;
  }

  stopPlaybackExpo();
}

// Utils
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }























