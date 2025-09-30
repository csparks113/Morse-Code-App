// utils/audio.ts
// Ultra-low-latency Morse audio
// - Web: WebAudio oscillator + gain envelope for near-instant start
// - Native (iOS/Android): expo-av with preloaded tones, replayAsync(), pre-warm, and ping-pong players

import { Platform } from 'react-native';

// Shared settings
import { useSettingsStore } from '../store/useSettingsStore';

export function getMorseUnitMs(): number {
  const { wpm } = (useSettingsStore.getState() as any) || { wpm: 20 };
  return Math.max(20, Math.round(1200 / Math.max(5, Number(wpm) || 20)));
}

export type PlayOpts = {
  onSymbolStart?: (symbol: '.' | '-', durationMs: number) => void;
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
let webPlaying = false;
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
    webGain!.gain.linearRampToValueAtTime(1, webCtx!.currentTime + 0.005);
    webPlaying = true;
    await sleep(dur);
    if (token !== webCancel) {
      // stop
      webGain!.gain.cancelScheduledValues(webCtx!.currentTime);
      webGain!.gain.linearRampToValueAtTime(0, webCtx!.currentTime + 0.003);
      webPlaying = false;
      opts.onSymbolEnd?.(sym, dur);
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
// NATIVE PATH: expo-av
// ---------------------------------------------------------------------------
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

let nativeToken = 0;
let dotA: Audio.Sound | null = null;
let dotB: Audio.Sound | null = null;
let dashA: Audio.Sound | null = null;
let dashB: Audio.Sound | null = null;
let cachedFreq = -1;
let cachedUnit = -1;

export async function configureAudio() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      playThroughEarpieceAndroid: false,
    });
  } catch {}
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

async function playMorseCodeNative(code: string, unitMsArg?: number, opts: PlayOpts = {}) {
  const my = ++nativeToken;
  const { toneHz } = (useSettingsStore.getState() as any) || { toneHz: 600 };
  const unitMs = Math.max(10, Math.floor(unitMsArg ?? getMorseUnitMs()));
  const hz = Math.max(100, Math.min(2000, Math.floor(opts.hz ?? toneHz ?? 600)));

  await configureAudio();
  await ensureNativeTones(hz, unitMs);

  for (let i = 0; i < code.length; i++) {
    if (my !== nativeToken) return;
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function playMorseCode(code: string, unitMsArg?: number, opts: PlayOpts = {}) {
  if (Platform.OS === 'web') return playMorseCodeWeb(code, unitMsArg, opts);
  return playMorseCodeNative(code, unitMsArg, opts);
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
    // assume toMorse exists elsewhere in your utils; import locally to avoid circular deps
    const { toMorse } = await import('./morse');
    const code = toMorse(ch);
    if (!code) continue;
    await playMorseCode(code, unitMs, opts);
    const next = chars[i + 1];
    if (next && next !== ' ') {
      await sleep(unitMs * 3);
    }
  }
}

export function stopPlayback() {
  if (Platform.OS === 'web') return stopPlaybackWeb();
  nativeToken++;
  for (const s of [dotA, dotB, dashA, dashB]) { try { s?.stopAsync(); } catch {} }
}

// Utils
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
