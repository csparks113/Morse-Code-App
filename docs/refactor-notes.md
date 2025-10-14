### Using This Log

- Capture each day's finished work in **Completed (Today)** so anyone skimming the file can see what moved recently.
- Treat **Next Steps** as the living backlog: rewrite items when priorities shift and remove them only after the work ships.
- When you pick up a task, copy the relevant bullet into your working notes and expand it with acceptance criteria, links, or test plans.
- Keep the touchpoint inventory in sync with reality so new contributors always see which surfaces we currently drive.

## Completed (2025-10-13)

- Archived the 2025-10-12 console replay logs and timeline CSVs under `docs/logs/Archive/js-timer-replay/` so the retired JS timer baseline stays reference-only.
- Reworked `docs/outputs-investigation.md` to track the native dispatcher rollout and reference the archive instead of enumerating every legacy sweep.
- Documented the native dispatcher flow: Nitro `OutputsAudio` now raises scheduled/actual callbacks, `utils/audio.ts` forwards them into `defaultOutputsService`, and replay torch stays disabled while we align flash/haptic on the native timeline.
- Chose to go all-in on the native dispatcher for replay outputs so the native callbacks own flash/haptic/torch timing and JS becomes a thin telemetry shim.
- Rewired the JS layer to treat dispatcher phases explicitly: actual callbacks fire flash/haptic immediately, scheduled callbacks log metadata only, and the analyzer now reports phase coverage to catch drift.
- Threaded replay output toggles into Nitro and added an Android `NativeOutputsDispatcher` bridge so console replays can drive torch/vibration directly when actual callbacks fire (flash hook-up still pending).

## Completed (2025-10-12)

- Added an adaptive `preScheduleLeadMs` path in `defaultOutputsService.flashPulse` so flash commits pre-arm `requestAnimationFrame` up to ~190 ms early based on recent `scheduleSkewMs` samples (new trace field + smoothing guard), aiming to collapse the 80-200 ms flash jitter without reintroducing audio-start headroom.
- Replay scheduling now prefers `nativeExpectedTimestampMs` when present (`resolvePlaybackRequestedAt`) so Play Pattern flashes queue ahead of the tone and give the adaptive lead real headroom.
- Guard now enforces a small target margin when applying `audioStartLeadMs`, clamping leads to available headroom so flashes stay a few ms ahead instead of collapsing back to zero headroom.
- Audio-start guard now requires >=12 ms headroom before staying in audio-start mode, zeroes any compensation, and falls back to the 24 ms timeline offset to stop runaway skew.
- Extended the same adaptive sampler to apply a capped `audioStartLeadMs` (<=96 ms) when we stick with audio-start scheduling so flashes lead by the measured JS skew while the analyzer keeps `preScheduleLeadMs` + `audioStartLeadMs` aligned.
- Trimmed timeline fallback offset to 12 ms (with an 8 ms flash lead) so guard fallbacks stay closer to the audio track.
- Relaxed the audio-start guard to 6 ms headroom (margin 2 ms) so more pulses stay on the native schedule while keeping a small safety buffer.
- Console Play Pattern sweeps now skip the age/headroom guard, enforce a 24 ms audio-start lead, and pair with a 12 ms tone lead so flashes stay ahead of the audio track.
- Boosted the adaptive lead baseline (36 ms, ratio 1.0 with 8 ms offset) so short guard successes get an earlier JS pre-arm and stay in audio-start.
- Parsed the 13:56 (35.9 ms audio->flash mean) and 14:39 (39.6 ms) Play Pattern sweeps to quantify residual flash spikes: 259 commits at 117.7 ms mean / 179 ms p95 with every pulse <=60 ms, and 467 commits at 123.4 ms mean / 201 ms p95 (p99 421 ms) with 90 ms pulses peaking at 494 ms.
- Trimmed `OutputsAudio` tone lead to 20 ms with a 12 ms gap cushion so tones no longer start far ahead of their slots at higher WPM.
- Reworked the flash/haptic dispatcher to remain in audio-start mode with zero headroom and drive pulses via `requestAnimationFrame`, eliminating `audioStartCompensationMs` in the latest sweeps.
- Taught the analyzer to read UTF-16 logcat captures (`Get-Content -Encoding Unicode`) so reported latencies reflect the on-device behaviour.
- Captured the 13:39/14:39 Play Pattern sweeps showing audio->flash means around 35-40 ms with audible gaps restored at roughly 15+ WPM; remaining spikes now stem from JS timer jitter, not guard fallback.

## Completed (2025-10-11)

- Restored structured `[outputs]` logging in `services/outputs/trace.ts` so every trace lands as a single-line JSON payload for the analyzer.
- Threaded `monotonicTimestampMs` through live keyer events in `services/outputs/defaultOutputsService.ts`, keeping flash/haptic/tone/torch telemetry aligned with Nitro offsets during sweeps.
- Rebuilt `scripts/analyze-logcat.ps1` to parse the JSON payloads, correlate `playMorse.symbol` events, and compute channel deltas; fresh runs on `docs/logs/console-replay-20251011-122422-play-pattern.txt` and `docs/logs/send-freeform-20251011-133848-sweep.txt` confirm audio->flash 17 ms / 4.7 ms means with native delays staying inside 86 ms / 57 ms p95.
- Added an 8 ms scheduling lead inside `services/outputs/defaultOutputsService.flashPulse` so developer-console flash pulses start slightly earlier on the monotonic timeline, targeting tighter audio->flash alignment.
- Wired `audioStartMs` through the replay path so flash pulses align with the Nitro audio clock before falling back to timeline offsets.
- Added guardrails around audio-start scheduling (minimum headroom, native skew/age checks, timeline fallback) so we only align to native audio when we have fresh headroom instead of slipping into the 16:12 regression.
- Extended the JS-side guard with `audioStartCompensationMs` (now up to ~160 ms) plus a `requestAnimationFrame` scheduler so short-delay pulses fire closer to their native targets while we prototype native batching.
- Pre-scheduled Nitro playback symbols in `OutputsAudio` (`getScheduledSymbols`) and surfaced them through `utils/audio.ts`, giving JS consumers the full native timeline ahead of dispatch.
- Instrumented native playback to expose `expectedTimestampMs`, `startSkewMs`, `batchElapsedMs`, and `ageMs` (see `outputs-native/android/c++/OutputsAudio.cpp` + `utils/audio.ts` + `services/outputs/defaultOutputsService.ts`) so analyzer traces can correlate spike clusters with JS timer skew.

## Completed (2025-10-09)

- Integrated the forced `forceCutOutputs` + release signal flow across `useSendSession`, `useKeyerOutputs`, and `KeyerButton` so any queued verdict or interaction disable clears active tone/flash/haptic outputs.
- Restored the flash overlay behind session UI layers while keeping pulses visible on send/receive/practice screens.
- Scrubbed hook dependencies (notably `useSendSession`) so TypeScript no longer warns about stale refs after the outputs cleanup.
- Prompt card now auto-reveals the correct answer after wrong send submissions, keeping MorseCompare in sync with verdict state.
- Threaded a configurable verdict buffer (default 200 ms via `constants/appConfig.ts`) so queueVerdict waits for the banner animation before cutting outputs.
- Hardened torch teardown with a reset fallback when native release fails and widened Morse signal/gap tolerances to stop premature verdicts on dot-led characters.
- Added a post-release torch force-off pass so every forced cut explicitly drives the hardware OFF even when the native release succeeds.
- Verdict buffer restarts whenever a new press begins so the user always gets the full timing window before we render the verdict.
- Added a verdict-finalizing guard so inputs that collide with banner rendering no longer trigger audible click artifacts.
- Deferred send verdict computation until banner display so we re-check the captured input before scoring, preventing premature wrong/correct decisions and catching extra dots/dashes.
- Surfaced the developer-console `ignorePressRef` indicator so testers can see when the keyer has entered ignore mode without digging into logcat.

## Completed (2025-10-06)

- Routed Nitro native offsets through JS pulse scheduling so flash/haptic outputs wait for the captured timeline and latency logs include the scheduled delay.

## Completed (2025-10-05)

- Swapped the keyer button over to a native-backed gesture handler so down/up timestamps now come from the gesture pipeline, reducing missed rapid dots.
- Finalised the bridgeless Nitro baseline across docs and the README so onboarding starts from the New Architecture + Nitro OutputsAudio stack.
- Documented developer console **Play Pattern** drift and the send keyer dot-leading misclassification across the log, Nitro prep notes, and living spec.
- Trimmed Nitro integration and outputs rewire plans to remove Audio API-first guidance while highlighting the remaining tuning backlog.
- Synced the living spec architecture/details with the current bridgeless runtime so cross-platform contributors have an accurate map.

## Next Steps
- Finish wiring the Android dispatcher so native callbacks drive flash/haptic/torch end-to-end (respect brightness percentages, ensure torch clean-up, keep JS telemetry-only), then mirror the bridge on iOS when hardware is available.
- Harden the Kotlin helper against missing hardware, expose brightness hooks, and confirm JS fallbacks remain safe when native actuation succeeds or fails.
- Capture new Play Pattern sweeps at 10/20/30 WPM (torch still disabled) to confirm <20 ms audio->flash/haptic and review dispatch-phase coverage in the analyzer.
- Re-enable torch and SOS/receive sweeps once the native dispatcher holds, archive the new baselines, and document the steady-state workflow for native-driven outputs.
### Deferred: Outputs Testing

- Extend the freeform sweeps to high-WPM stress cases and confirm the relaxed classifiers still hold; log any misreads or latency drifts in `docs/outputs-investigation.md`.
- Archive a dated logcat bundle once the verdict buffer and torch reset are validated; keep the summary table in sync with `docs/android-dev-client-testing.md`.
- Add an automated or logged guard for the developer console `ignorePressRef` indicator after the manual validation pass beds in.

### Console Replay Alignment

1. Use the console **Play Pattern** button as the primary replay test, capturing offsets for tone, flash, haptic, and torch after each change.
2. Record key findings (offset deltas, spike timestamps) in `docs/outputs-alignment-notes.md` and link to the archived log under `docs/logs/`.
3. If alignment regresses, triage with the new spike traces and escalate to native with concrete samples.

### Keyer Precision

1. During freeform sweeps, log dot-led phrases and high-WPM retries to verify the updated tolerances and deferred verdict logic.
2. Capture examples of any lingering misclassifications with `keyer.classification` traces and outline proposed tuning in `docs/outputs-investigation.md`.
3. Once a tuning change lands, back it with either unit coverage or a watchdog log so we can detect regressions automatically.

### Outputs Alignment Monitoring

1. Keep Nitro timestamp threading in place (monotonic timeline, torch scheduling) and validate via the Play Pattern captures.
2. Watch for recurring ``playMorse.nativeOffset.spike`` events; if they cluster, document hypotheses plus log snippets we can revisit when tuning the native timeline.
3. After each meaningful change, archive the relevant logcat file and refresh both the alignment and investigation docs with the deltas.

### Operational Follow-ups

1. Keep `README.md` and `docs/living-spec.md` fresh whenever architecture or known issues shift.
2. Schedule console/outputs telemetry reviews after dependency bumps (Expo SDK, Nitro modules, Hermes) to catch regressions quickly.

### Lessons Tab Restructure (see docs/lessons-structure-plan.md)

1. Design section/subsection data model and update navigation routes to support the new hierarchy (see docs/lessons-structure-plan.md).
2. Redesign the lessons entry point into a sections overview with progress bars and accordion subsections.
3. Ensure lesson path screens receive section/subsection context while keeping existing header styling.
4. Update progress analytics and storage to track section + subsection completion.

### Practice-Tab Groundwork (see docs/practice-revamp-plan.md)

1. Inventory the shared components the practice tab will reuse (keyboards, summary cards, toggles) and confirm each has tokens/theming hooks.
2. Define navigation and data scaffolding for practice flows so future tasks are additive rather than structural.
3. Collect and log practice-content ideas/TODOs in a dedicated subsection of this file or companion doc.

### Practice Modes Revamp (see docs/practice-revamp-plan.md)

1. Ship the new Practice tab card layout with themed modes (Timing/Target/Custom).
2. Build setup flows for each mode (configuration screens -> start session).
3. Implement timing drill surfaces with scrolling target/user graphs and accuracy feedback.
4. Reuse lesson send/receive shells for Target/Custom modes with mode-specific styling.
5. Introduce a mode registry/config so future practice modes are plug-and-play (see docs/practice-revamp-plan.md).

### Multi-language Expansion (see docs/multilanguage-plan.md)

1. Finish i18n sweep so all UI/lesson copy lives in resource bundles and is language-switchable.
2. Build per-language keyboard layouts and wire them into lessons/keyer flows.
3. Extend lesson data (characters, words, sentences) for Latin-based languages with diacritics.
4. Update settings UI/workflows to add language selection and persistence.
5. Capture the process in docs/multilanguage-plan.md and add localization QA checklists.

### iOS Bridgeless Bring-up

1. Run the iOS setup checklist to confirm Nitro registers and haptics/torch parity hold on device.
2. Capture Expo run/Metro logs equivalent to the Android reference and store them beside `latest-logcat.txt`.
3. Record any deltas or blockers in the investigation log and mirror them here.

## Historical Milestones

- Implemented Nitro `OutputsAudio` on Android with HybridObject registration, Oboe stream warm-up, and Expo env toggles for fallbacks.
- Added latency instrumentation across tone/haptic/flash/torch channels and surfaced telemetry in the developer console.
- Integrated Nitro dependencies, wired Nitrogen codegen into prebuild, and rebuilt the Android dev client from `C:\dev\Morse` for on-device validation.
- Documented developer console upgrades (manual triggers, latency summaries, torch indicator) and synced UI spacing/theme guards across session surfaces.

### Outputs Stability

- Completed 2025-10-09: `forceCutOutputs` now runs whenever verdicts queue or sessions end, and the keyer release signal clears button state so outputs never stay latched between questions.
- Completed 2025-10-08: Added watchdog logging when manual/dev-console handles fail to release tone/flash within expected timeouts (default outputs service records pressTimeout samples and force-cuts handles).
- Follow up with send/practice flows to ensure the verdict timers cancel pending pressStart correlations before queuing the next prompt (verify practice/send flows honour the cutActiveOutputs path).








