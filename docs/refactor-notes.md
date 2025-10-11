### Using This Log

- Capture each day's finished work in **Completed (Today)** so anyone skimming the file can see what moved recently.
- Treat **Next Steps** as the living backlog: rewrite items when priorities shift and remove them only after the work ships.
- When you pick up a task, copy the relevant bullet into your working notes and expand it with acceptance criteria, links, or test plans.
- Keep the touchpoint inventory in sync with reality so new contributors always see which surfaces we currently drive.

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

- Replace the placeholder raw log (`docs/logs/console-replay-20251010-aligned.txt`) with the actual Play Pattern logcat export and keep the summary in sync.
- Review the new `playMorse.nativeOffset.spike` traces (threshold now 80 ms) to determine whether native smoothing or clock calibration is needed.
- Spot-check torch alignment across send/practice flows post-fix and capture a follow-up logcat bundle if anything drifts.

### Deferred: Outputs Testing

- Device-verify the 200 ms verdict buffer, deferred verdict scoring, relaxed classifiers, and torch force-off fallback across low/high WPM drills; log findings in `docs/outputs-investigation.md`.
- Run the send-lesson regression sweep via `node scripts/run-send-regression.js`, execute the matrix in `docs/outputs-investigation.md`, and capture scenario findings plus device logs in the investigation log.
- Capture and archive a fresh logcat bundle with the verdict buffer + torch reset enabled for regression comparisons.
- Optional: Add automated checks or unit coverage around the developer console ignore-press indicator once the manual validation pass locks behaviour in.

### Console Replay Alignment

1. Instrument developer console **Play Pattern** runs to capture tone vs flash/haptic/torch offsets and log the deltas in `docs/android-dev-client-testing.md`.
2. Iterate on the Nitro replay scheduler and timeline offsets until drift stays under ~5 ms across the WPM range.
3. Validate fixes via developer console exports and attach representative traces (latency tables + `[outputs-audio]`) to the investigation log.

### Keyer Precision

1. Audit high-WPM dot/dash thresholds; correlate latency samples with `keyer.classification` traces to isolate failure cases.
2. Prototype adaptive thresholds or hysteresis that protect dot-leading sequences, then document the new rules in `services/outputs` helpers.
3. Add a regression guard (unit test or log assertion) once the heuristics stabilize.

### Outputs Alignment (Incremental Plan)

1. Finish integrating native keyer press tracking so rapid dots use monotonic timestamps; update telemetry and regression guards once the module lands.
2. Wire Nitro symbol timestamps through JS consumers (OutputsService, flash/torch controllers) and retime the replay/console paths around the native start time (flash/haptic done; torch scheduling still pending).
3. If flash/haptic drift persists, add native-driven flash/torch triggers as the next increment and benchmark the results.
4. After each increment, archive fresh logcat captures under `docs/logs/`, compare them against prior runs, and summarize the deltas here.

### Operational Follow-ups

1. Keep `README.md` and `docs/living-spec.md` fresh whenever architecture or known issues shift.
2. Schedule console/outputs telemetry reviews after dependency bumps (Expo SDK, Nitro modules, Hermes) to catch regressions quickly.

### Lessons Tab Restructure

1. Design section/subsection data model and update navigation routes to support the new hierarchy (see docs/lessons-structure-plan.md).
2. Redesign the lessons entry point into a sections overview with progress bars and accordion subsections.
3. Ensure lesson path screens receive section/subsection context while keeping existing header styling.
4. Update progress analytics and storage to track section + subsection completion.

### Practice-Tab Groundwork

1. Inventory the shared components the practice tab will reuse (keyboards, summary cards, toggles) and confirm each has tokens/theming hooks.
2. Define navigation and data scaffolding for practice flows so future tasks are additive rather than structural.
3. Collect and log practice-content ideas/TODOs in a dedicated subsection of this file or companion doc.

### Practice Modes Revamp

1. Ship the new Practice tab card layout with themed modes (Timing/Target/Custom).
2. Build setup flows for each mode (configuration screens -> start session).
3. Implement timing drill surfaces with scrolling target/user graphs and accuracy feedback.
4. Reuse lesson send/receive shells for Target/Custom modes with mode-specific styling.
5. Introduce a mode registry/config so future practice modes are plug-and-play (see docs/practice-revamp-plan.md).

### Multi-language Expansion

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
