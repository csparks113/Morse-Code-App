### Using This Log
- Capture each day's finished work in **Completed (Today)** so anyone skimming the file can see what moved recently.
- Treat **Next Steps** as the living backlog: rewrite items when priorities shift and remove them only after the work ships.
- When you pick up a task, copy the relevant bullet into your working notes and expand it with acceptance criteria, links, or test plans.
- Keep the touchpoint inventory in sync with reality so new contributors always see which surfaces we currently drive.

## Completed (Today - 2025-10-05)
- Swapped the keyer button over to a native-backed gesture handler so down/up timestamps now come from the gesture pipeline, reducing missed rapid dots.
- Finalised the bridgeless Nitro baseline across docs and the README so onboarding starts from the New Architecture + Nitro OutputsAudio stack.
- Documented developer console **Play Pattern** drift and the send keyer dot-leading misclassification across the log, Nitro prep notes, and living spec.
- Trimmed Nitro integration and outputs rewire plans to remove Audio API-first guidance while highlighting the remaining tuning backlog.
- Synced the living spec architecture/details with the current bridgeless runtime so cross-platform contributors have an accurate map.

## Next Steps

- Verify the new keyer gesture handler and verdict delay on device (Practice Keyer + send lesson) before landing further changes.

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
2. Wire Nitro symbol timestamps through JS consumers (OutputsService, flash/torch controllers) and retime the replay/console paths around the native start time.
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
