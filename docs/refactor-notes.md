### Using This Log
- Capture each day's finished work in **Completed (Today)** so anyone skimming the file can see what moved recently.
- Treat **Next Steps** as the living backlog: rewrite items when priorities shift and remove them only after the work ships.
- When you pick up a task, copy the relevant bullet into your working notes and expand it with acceptance criteria, links, or test plans.
- Keep the touchpoint inventory in sync with reality so new contributors always see which surfaces we currently drive.

## Completed (Today)
- Relocated the workspace to `C:\dev\Morse`, reinstalled native dependencies, and rebuilt the Android dev client (with `expo-linear-gradient` + `react-native-audio-api`) so the app launches on device ahead of latency validation.
- Defined the `OutputsAudio` Nitro interface, regenerated Nitrogen bindings, and documented the audio plugin override defaults in `docs/nitro-integration-prep.md`.
- Built the shared `ToneController` in `utils/audio.ts` and migrated `services/outputs/defaultOutputsService` to the audio-api-first flow with backend-tagged latency logging.
- Added the AudioAPI Gradle override plugin (`plugins/withAudioApiAndroidConfig.js`) and began logging keyer touch-to-output latency (tone/haptic/flash/torch) through the outputs service.
- Integrated `react-native-audio-api` scaffolding: updated `utils/audio.ts` to prefer the Nitro module with an expo fallback, wired the Expo config/plugin, and added the placeholder Nitro spec (`outputs-native/audio.nitro.ts`).
- Extended outputs instrumentation with a shared `pressTracker` helper, replay latency capture (`OutputsService.playMorse`), and Nitro-ready metadata across send/receive/dev console flows.
- Installed Nitro dependencies (`react-native-nitro-modules`, `react-native-nitro-haptics`, `nitrogen`), wired `npm run nitro:codegen` via `withNitroCodegen`, and migrated Expo settings to `app.config.ts` for pluggable stacks.
- Made the developer console action footer scrollable so manual triggers and toggles stay reachable on smaller screens.
- Gated torch diagnostics to developer mode and mirrored torch telemetry inside the developer console.
- Surfaced per-channel latency telemetry (tone/haptic/flash/torch) plus reset controls in the developer console.
- Migrated native audio playback from `expo-av` to `expo-audio` and updated docs to reflect the new package.
- Extended the session style guard to lint `app/dev` and the practice tab after routing colors through shared theme surfaces.
- Pulled SessionHeader into the developer console and practice tab, wiring their copy onto header tokens and reusing summary spacing for practice sections.
- Routed SessionHeader and SessionSummary layout spacing through `sessionLayoutTheme` header/summary tokens to remove inline overrides.
- Documented the developer console upgrades (`docs/developer-console-updates.md`), including offset controls, quick filters, torch indicator, and source-tagged ``outputs.*`` traces across send/receive/manual flows.
- Centralized prompt action configuration in `hooks/useSendSession.ts` and `hooks/useReceiveSession.ts`.
- Updated send/receive screens to consume hook-provided `revealAction`/`replayAction` and removed local memoization.
- Refreshed `PromptCard` styles to use shared `promptCardTheme` tokens; added the theme block to `theme/lessonTheme.ts`.
- Ensured `npx tsc --noEmit` passes after the refactor.
- Introduced `sessionControlTheme` tokens and refactored session controls to consume shared sizing constants.
- Wired footer spacing through `sessionLayoutTheme.footer` and added `npm run check:session-controls` guard.
- Standardized session footer safe-area helpers via `sessionLayoutTheme` variants across send/receive summary flows; laid down tokens for dev/practice.
- Routed send/receive replay outputs (flash, haptics, audio) through the shared `OutputsService`.
- Added `scripts/check-session-style-guard.js` to block new hard-coded spacing/colors inside `components/session` and chained it into `npm run check:session-controls`.
- Refactored `useKeyerOutputs`/`KeyerButton` to delegate press effects to the outputs service handle, sharing monotonic timing helpers and removing Expo module callsites from the hook.
- Introduced developer-mode tracing (`store/useDeveloperStore.ts`, `services/outputs/trace.ts`) so keyer outputs log latency events only when the toggle is enabled.

### Session Control Theme Usage
- Import `sessionControlTheme` and `spacing()` in session controls; any hard-coded padding or color now fails the `npm run check:session-controls` guard.
- Read sizes, radii, and typography from `sessionControlTheme.<component>` so action buttons, toggles, and the keyer stay visually aligned; override via tokens, not inline numbers.
- Preserve touch targets by keeping vertical spacing steps >= 2 (~16dp) and respecting the provided `fontSize`/`letterSpacing` guidance when localizing labels.
- Pair controls with `sessionLayoutTheme` helpers (for example footer safe-area shims) instead of bespoke offsets so layouts stay responsive across devices.

### Output Touchpoint Matrix (Oct 2025)
| Hook / Surface | Outputs | Timing Knobs | Instrumentation / Latency Notes |
| --- | --- | --- | --- |
| `useSendSession` | `OutputsService.flashPulse` & `hapticSymbol`; `playMorse` for replay loops | `signalTolerancePercent`, `gapTolerancePercent`, `getMorseUnitMs()` | Replay uses idle/gap classifiers; now emits `playMorse.*` and `outputs.*` pulses tagged with `session.send`. |
| `useReceiveSession` | `OutputsService.flashPulse`, `hapticSymbol`, `playMorse` for target playback | `flashOffsetMs`, `hapticOffsetMs`, `getMorseUnitMs()` | Emits `outputs.*` pulses with `session.receive` source; still relies on configurable offsets to mask hardware latency. |
| `useKeyerOutputs` + `KeyerButton` | `OutputsService.createKeyerOutputs` sidetone + haptics + flash + torch | `toneHz`, `audioEnabled`, `lightEnabled`, `torchEnabled`, monotonic press timestamps | Emits `keyer.*` trace events; console pulses appear via `outputs.*` when developer tracing is enabled. |
| `services/outputs/defaultOutputsService` | Shared flash/haptics/audio helpers plus keyer handle | `computeFlashTimings`, `clampToneHz`, optional `prepare()` warm-up | Emits `outputs.flashPulse`/`outputs.hapticSymbol` traces with source metadata; keyer surfaces retain `keyer.*` events. |

## Next Steps

### Session UI Cleanup
1. Observe the new spacing/color guard over the next few session updates and expand it beyond `components/session` once the signal stays clean.
2. Monitor guard coverage across dev/practice and plan the next expansion (settings/home) once the signal stays clean.

### Audio Orchestrator
1. Run on-device smoke tests (iOS/Android) to confirm the audio-api-first tone controller spins up quickly and logs backend metadata.
2. Review the audio API Expo plugin options (background audio, permissions) and document overrides in `docs/nitro-integration-prep.md`.
3. Implement the native `OutputsAudio` Nitro module once device validation passes, then wire the orchestrator entry points.

### Hygiene & Guardrails
1. Update `docs/codex-handoff.md` at the end of every working session and run `npm run verify:handoff` so new chats resume with full context.
2. Extend docs with session UI conventions and outputs service architecture notes so new contributors follow the same patterns.
3. Prepare an Expo smoke-test checklist (send, receive, summary) to run after major changes and link it in this doc.
4. Add simple mocks/tests around the outputs service to protect against regressions during future rewrites.
5. Integrate `npm run check:session-controls` into CI so the spacing guard runs automatically (not just locally).

### Output Touchpoint Inventory (Current)\r\n- Status: Pending; monitor alongside Foundations work so UI + telemetry docs stay aligned.\r\n1. Surface torch availability and instrumentation feedback in the UI (fallback messaging + metrics).
2. Document the offset-tuning workflow and expose the knobs inside the developer console.
3. Publish a short guide summarising the new `outputs.*` trace metrics (latency, source counts) so offset tuning is data-driven.

### Output Architecture Preparation\r\n- Status: Carry forward; schedule after Foundations benchmarks unless console gaps block latency tooling.\r\n1. Persist console filter/search state once developer mode toggles survive reloads.
2. Prototype segmented trace buffers versus the current 200-event ring before raising history limits.
3. Explore file-based or streaming exports so long developer sessions are not limited by the Share sheet payload size.
4. Add a Settings � Output card (below Language) linking to an output settings screen covering audio volume, tone frequency, vibration intensity, and screen flash brightness�with room to extend later.

### Outputs Rewire Plan
- Status 2025-10-03: Shared `ToneController` + audio-api-first playback are live; device validation and Nitro outputs bindings remain outstanding.
1. Foundations & benchmarks:
   - Run a compatibility audit for `react-native-audio-api` / `react-native-nitro-haptics` (RN 0.81, Expo SDK 54, hermes, autolinking) and log any native dependency caveats.
   - Stage package installs + Expo prebuild smoke so we know the JSI modules compile in dev client and EAS profiles.
   - Layer instrumentation on current keyer + OutputsService paths to capture touch-to-output latency (audio, haptics, flash, torch) with p50/p95/jitter aggregates recorded in the developer console.
   - Draft the orchestrator contract (prep/engage/release/cancel/timeline offset + telemetry hooks) ahead of implementation.
   - Guardrail: `react-native-audio-api@0.8.2` enforces RN >=0.76 and its Expo config plugin enables background audio/foreground-service hooks by default; review and override those options if we do not want to request background media permissions in production.
   - Capture the Android overrides we need: raise `AudioAPI_compileSdkVersion/targetSdkVersion` to 34 and `AudioAPI_ndkVersion` to Expo's NDK (26.1+) via root project `ext` so builds stay on the supported toolchain. Install `react-native-worklets@~0.6.0` alongside the audio stack.
   - Note: the iOS pod vendors FFmpeg xcframeworks (~30 MB) and the Android side packages Oboe plus a foreground service; keep an eye on binary size and Play Store foreground-service policies.
   - Nitro path: `react-native-nitro-haptics@0.1.0` + `react-native-nitro-modules` (0.24.x) require New Architecture, minSdk 23, compile 34/target 35, and NDK 27.1. Plan to run Nitrogen codegen during prebuild and leave `newArchEnabled` true in Expo configs.
2. Audio + haptics: integrate react-native-audio-api and react-native-nitro-haptics with oscillator warm-up hooks.
3. Visual channels: rebuild FlashOverlay with Reanimated UI worklets and wire torch control via expo-torch.
4. Orchestration: add an OutputsOrchestrator service and rewire session/practice hooks plus toggles.
5. Keyer precision: move the send keyer onto react-native-gesture-handler with high-res timing and improved diagnostics.
6. QA & ops: run device smoke tests, add calibration UX, expand tracing, and finish EAS prep.

### Outputs Rewire Fallbacks
- Audio: fall back to a minimal custom Expo Module if react-native-audio-api cannot sustain the <=10 ms target.
- Haptics: fall back to expo-haptics on unsupported hardware while keeping Nitro as the preferred path.
- Screen flash: promote the overlay to a native view if Reanimated animations stutter or layer ordering fails.
- Torch: detect OEM throttling and gracefully fall back to screen-flash-only feedback when torch pulses fail.
- Keyer: expose calibration controls and tap histograms if gesture thresholds still misclassify dots/dashes.

- Reference: docs/outputs-rewire-plan.md for full specification.

### Developer Mode Shell
1. Publish an offset-tuning walkthrough (linking the new metrics to recommended baselines) so the team can calibrate devices consistently.
2. Add timeline filtering/pinning in the console (time range, event bookmarks) to make long trace sessions easier to audit.
3. Support saving/loading manual pattern presets so testers can jump between common sequences without retyping.

### Lessons Tab Restructure
1. Design section/subsection data model and update navigation routes to support the new hierarchy (see docs/lessons-structure-plan.md).
2. Redesign the lessons hamburger entry point into a sections overview with progress bars and accordion subsections.
3. Ensure lesson path screens receive section/subsection context while keeping existing header styling.
4. Update progress analytics and storage to track section + subsection completion.

### Practice-Tab Groundwork
1. Inventory the shared components the practice tab will reuse (keyboards, summary cards, toggles) and confirm each has tokens/theming hooks.
2. Define navigation and data scaffolding for practice flows so future tasks are additive rather than structural.
3. Collect and log practice-content ideas/TODOs in a dedicated subsection of this file or companion doc.

### Practice Modes Revamp
1. Ship the new Practice tab card layout with themed modes (Timing/Target/Custom).
2. Build setup flows for each mode (configuration screens ? start session).
3. Implement timing drill surface with scrolling target/user graphs and accuracy feedback.
4. Reuse lesson send/receive shells for Target/Custom modes with mode-specific styling.
5. Introduce a mode registry/config so future practice modes are plug-and-play (see docs/practice-revamp-plan.md).

### Multi-language Expansion
1. Finish i18n sweep so all UI/lesson copy lives in resource bundles and is language-switchable.
2. Build per-language keyboard layouts and wire them into lessons/keyer flows.
3. Extend lesson data (characters, words, sentences) for Latin-based languages with diacritics.
4. Update settings UI/workflows to add language selection and persistence.
5. Capture the process in docs/multilanguage-plan.md and add localization QA checklists.























