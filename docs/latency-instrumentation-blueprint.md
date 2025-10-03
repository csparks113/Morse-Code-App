# Latency Instrumentation Blueprint

## Goals
- Capture comparable touch-to-output latency metrics for tone, haptic, flash, and torch channels without relying on manual stopwatch logging.
- Reuse the same telemetry surface across live sessions, developer console pulses, and replay flows so the data survives the OutputsOrchestrator refactor.
- Feed developer-console summaries (p50/p95/jitter + last sample) from a single store that can also back automated regression checks.

## Touch Timeline
1. **Press detected** - `KeyerButton` / practice inputs fire a gesture-handler `onBegin` or `onStart` callback.
2. **OutputsService dispatch** - channel toggles (sidetone, haptics, flash, torch) are invoked from the shared OutputsService handle.
3. **Native completion** - tone generator, haptic module, and flash/torch animations commit work on their respective threads.
4. **Replay instrumentation** - `OutputsService.playMorse` and future orchestrator timelines produce channel events without a live press.

All timestamps are normalized with `nowMs()` / `toMonotonicTime()` so JS, UI, and native callbacks share a monotonic clock.

## Capture Points
- **Press start / end**
  - Add a `services/latency/pressTracker.ts` helper that receives raw Gesture Handler event timestamps, normalizes them with `toMonotonicTime`, and emits `LatencyEvent('press.start' | 'press.end')`.
  - `useKeyerOutputs` will call into the helper from `handleRef.current.pressStart/pressEnd` so we reuse the same data whether the press originates from the keyer, practice tab, or developer console.
- **Tone output**
  - When `react-native-audio-api` is wired, emit `LatencyEvent('channel.tone')` from the native module callback that confirms audio buffer engagement. Until then, continue capturing `Audio.Sound.playFromBufferAsync` resolve timing as a stand-in.
- **Haptic output**
  - Wrap `OutputsService.hapticSymbol` so we emit immediately before dispatch and again after the Nitro module signals completion (post-integrations). For the expo-haptics fallback, capture the promise resolution.
- **Flash / torch output**
  - Inject hooks into `flashPulse` and `torch` helpers (`acquireTorch`, `Animated.sequence`) to capture when the UI thread schedules and when the torch promise resolves.
- **Replay + service pulses**
  - Extend `OutputsService.playMorse` `onSymbolStart` callback to emit synthetic press/channel pairs tagged with `source: 'replay'` so replay latency is comparable to live keying.

All capture helpers call a shared `recordLatencySample(channel, phase, source, timestamp)` API to avoid leaking module specifics into UI code.

## Telemetry Schema
```ts
export type LatencyChannel = 'tone' | 'haptic' | 'flash' | 'torch';
export type LatencySource = 'session.send' | 'session.receive' | 'console.manual' | 'replay';
export type LatencyPhase = 'press.start' | 'press.end' | 'channel.dispatch' | 'channel.commit';

export type LatencySample = {
  channel: LatencyChannel;
  source: LatencySource;
  phase: LatencyPhase;
  timestampMs: number; // monotonic
  correlationId: string; // UUID tying press + channel timelines together
  metadata?: Record<string, string | number | boolean>;
};
```
- A `LatencyEnvelope` groups samples per press: `{ correlationId, pressStartMs, pressEndMs, channelEvents: { [channel]: { dispatchMs, commitMs, latencyMs } } }`.
- Store envelopes in a bounded ring buffer (default 200 entries) keyed by channel so aggregates remain cheap.
- Device/build context (`Platform.OS`, version, `global.__turboModuleProxy`, `appBuild` hash) is attached once per envelope to assist remote analysis.

## Storage & Aggregation
- New Zustand store `useLatencyStore` provides:
  - `recordPress(correlationId, phase, timestamp, metadata?)` and `recordChannelEvent(correlationId, channel, phase, timestamp, metadata?)`.
  - Derived selectors for `getSamples(channel)`, `getAggregates(channel)` returning `{ count, mean, p50, p95, jitter, lastSample }`.
  - Export helpers to serialize buffers for CSV / JSON download from the developer console.
- Aggregations run lazily when samples change to keep render cost low; use incremental percentile calculation (P^2 algorithm) if simple sort becomes expensive.

## Developer Console Integration
- Extend the existing diagnostics panel with a "Latency" card that reads aggregates per channel, displays sparklines for the last 50 samples, and exposes a "Copy JSON" action.
- Use the same selectors in automated smoke tests (e.g., `npm run verify:latency`) to compare against golden thresholds on CI devices.

## Implementation Checklist
1. Scaffold `services/latency` with the store, `recordLatencySample`, and correlation helpers (use `crypto.randomUUID()` fallback for determinism in tests).
2. Patch `useKeyerOutputs` and developer console manual triggers to pass press timestamps down to the tracker helper.
3. Hook `flashPulse`, `hapticSymbol`, torch helpers, and the interim Expo audio path into the tracker.
4. Update `OutputsService.playMorse` to emit replay measurements tagged with `source: 'replay'`.
5. Surface aggregates inside the developer console and document the workflow in `docs/developer-console-updates.md` once telemetry is visible.
6. Backfill automated regression harness that runs against the simulator/dev client and stores snapshots for comparison.
