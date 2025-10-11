# Latency Instrumentation Blueprint

_Last updated: 2025-10-11_

This note captures how our touch-to-output latency telemetry is wired today and what to watch when we extend it. The instrumentation is live across send/practice sessions, replay flows, and the developer console.

## Purpose
- Keep touch-to-tone/haptic/flash/torch metrics comparable across manual testing and automated sweeps.
- Ensure every change to OutputsService or the keyer continues to feed a single latency store that powers console summaries and log analysis.
- Provide a quick checklist for extending the pipeline when we add new channels or platforms.

## Architecture Overview
1. **Press capture (`services/latency/pressTracker.ts`)**  
   Gesture Handler timestamps are normalised with `toMonotonicTime` and wrapped in correlation IDs so every press shares a clock with native callbacks.
2. **Outputs dispatch (`services/outputs/defaultOutputsService.ts`)**  
   Tone, haptic, flash, and torch helpers emit `recordLatencySample` events on dispatch and when commit callbacks fire (Nitro or fallback paths).
3. **Replay instrumentation (`OutputsService.playMorse`)**  
   Synthetic presses created during Play Pattern or lesson replay reuse the same correlation helpers, tagging samples with `source: 'replay'`.
4. **Timeline alignment**  
   All timestamps flow through `nowMs()` / `toMonotonicTime()`, giving us a monotonic baseline that matches the Nitro native offsets captured in `[outputs-audio]` logs.

## Telemetry Schema
```ts
type LatencyChannel = 'tone' | 'haptic' | 'flash' | 'torch';
type LatencySource = 'session.send' | 'session.receive' | 'console.manual' | 'replay';
type LatencySample = {
  channel: LatencyChannel;
  source: LatencySource;
  phase: 'press.start' | 'press.end' | 'channel.dispatch' | 'channel.commit';
  timestampMs: number; // monotonic
  correlationId: string;
  metadata?: Record<string, string | number | boolean>;
};
```
- Samples consolidate into latency envelopes so we can compute deltas (for example `touchToTone`, `touchToTorch`) without reprocessing raw streams.
- Device context (platform, build hash) is captured once per envelope so exported logs remain self-describing.

## Storage & Aggregation
- `useOutputsLatencyStore` maintains a bounded buffer (default 200 envelopes per channel) and exposes derived aggregates: count, mean, p50, p95, jitter, and the most recent sample.
- `recordLatencySample` is the only public entry point—call it whenever a new channel dispatch or commit fires to keep the store coherent.
- `scripts/analyze-logcat.ps1` reads the same envelopes from logcat exports, ensuring CLI analysis matches the in-app console view.

## Developer Console Integration
- The latency card in developer mode pulls selectors from `useOutputsLatencyStore`, rendering aggregate stats plus sparklines for the latest 50 samples.
- Manual triggers (`Dot`, `Dash`, `Play Pattern`) pass press IDs down to the tracker so console testing and lesson flows share telemetry.
- The console exposes JSON export to capture envelopes for later diffing; these files are what we archive under `docs/logs/` after sweeps.

## Extending the Pipeline
- **New channels:** add a `LatencyChannel` entry, wire dispatch/commit calls through `recordLatencySample`, and update the console card to display the new metrics.
- **Platform-specific callbacks:** when native modules gain richer timing (for example improved torch callbacks), normalise them with `toMonotonicTime` before recording.
- **Automated checks:** reuse store selectors inside smoke tests or scripts; the buffers are deterministic when seeded with logged presses.
- **Telemetry hygiene:** whenever OutputsService is refactored, confirm the press tracker still receives begin/end notifications and that each channel logs both dispatch and commit phases.

Keeping this blueprint current ensures we can diagnose latency spikes quickly without re-learning how the instrumentation fits together.
