# Outputs Rewire Plan

This plan tracks the remaining work needed to deliver a fully native, low-latency outputs pipeline across tone, haptic, flash, and torch channels.

## Current Baseline (2025-10-05)
- Nitro `OutputsAudio` ships with the Android dev client and is the default audio path; Audio API fallback remains behind env toggles for diagnostics.
- Nitro haptics, flash overlay, and torch integrations are wired through the developer console and session flows with latency instrumentation (`keyer.*`, `[outputs-audio]`).
- Developer console exposes manual triggers, latency summaries, and offset controls; outstanding drift and keyer accuracy items are tracked below.

## Objectives
1. Keep all four output channels aligned within ~5 ms during manual and session-driven playback.
2. Guarantee accurate keyer classification at higher WPM without sacrificing responsiveness.
3. Prepare an orchestrated outputs service that can scale to additional practice modes and future channels.
4. Maintain clear telemetry so regressions surface immediately in developer tooling.

## Focus Areas

### Nitro Replay Alignment
- Profile developer console **Play Pattern** runs to quantify tone vs flash/haptic/torch offsets across WPM settings.
- Tune Nitro replay scheduling (native timeline offsets, warm-up, cancellation hooks) until drift stays within target bounds.
- Capture before/after traces and logcat snapshots in `docs/android-dev-client-testing.md` for future reference.

### Keyer Precision
- Audit dot/dash thresholds at high WPM and correlate with `keyer.classification` telemetry.
- Experiment with adaptive thresholds or hysteresis that stabilise dot-leading sequences (`...-`, `..-.`, etc.).
- Add regression guards (unit tests or watchdog logs) once the heuristics settle.

### Multi-Channel Orchestration
- Solidify the Outputs orchestrator contract (`prepare`, `engage`, `release`, `cancel`, `setTimelineOffset`) and wire session/practice hooks through it.
- Ensure telemetry remains tagged with source metadata (send, receive, console) and surfaces in developer mode.
- Document the orchestration flow in `docs/living-spec.md` once alignment work completes.

### Platform Parity
- Validate the iOS bridgeless dev client using the Nitro checklist; confirm registration, latency logging, and channel parity.
- Capture matching logs/metrics to compare with Android baselines and record any deltas.

### Operational Hygiene
- Keep Expo config plugins (`withNitroCodegen`, Audio API overrides) aligned with Nitro-first defaults.
- Refresh documentation and onboarding checklists after major dependency bumps (Expo SDK, Hermes, Nitro modules).
- Maintain a rolling log of latency measurements per device to detect drift over time.

## Incremental Roadmap (2025-10-05)
- **Step 1 - Native keyer input:** replace the React Pressable path with a Nitro-powered press tracker so down/up timestamps come from the native clock. Ship with telemetry updates and regression guards.
- **Step 2 - Native timestamp propagation:** surface Nitro OutputsAudio symbol metadata (start time, duration) through JS consumers and retime flash/torch scheduling around the native start time.
- **Step 3 - Native flash/torch fallback:** if JS scheduling still drifts, promote flash/torch triggers into the Nitro layer while keeping the JS UI for controls.
- **Step 4 - iOS parity:** port the winning combination to iOS once Android metrics lock in.

## Fallback: Full Native Orchestrator
If the incremental steps fail to hit the <=5 ms alignment target, fall back to a full native orchestration pass: move keyer input, flash overlay, and torch into Nitro alongside audio/haptics so the entire timeline executes on the native thread.

## Fallback Paths
- **Audio**: fall back to the Audio API or an Expo module only when Nitro is disabled (env toggles) or unsupported on hardware.
- **Haptics**: default to Nitro; Expo haptics remains the safety net for devices lacking Nitro support.
- **Flash**: rely on Reanimated UI worklets; evaluate native surface promotion if stutter appears.
- **Torch**: degrade to flash-only messaging when torch pulses fail or the capability badge reports unavailable hardware.
- **Keyer Input**: expose calibration controls if gesture thresholds continue to misclassify after tuning.

## Risks & Mitigations
- **Scheduler drift**: collect and compare replay traces after every change; revert quickly on regressions.
- **Device variability**: store per-device latency telemetry and keep developer console offsets configurable.
- **Permission UX**: ensure fallback messaging keeps lessons usable when torch/audio permissions are denied.
- **Doc rot**: tie major code changes to documentation updates so contributors stay aligned.

## Related Docs & Logs
- `docs/android-dev-client-testing.md`: investigation log + current known issues.
- `docs/nitro-integration-prep.md`: setup checklist and build tooling notes.
- `docs/developer-console-updates.md`: console capabilities and telemetry surfaces.
- `docs/living-spec.md`: architecture overview kept in sync with Nitro baseline.
