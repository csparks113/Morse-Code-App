### Using This Log
- Capture each day's finished work in **Completed (Today)** so anyone skimming the file can see what moved recently.
- Treat **Next Steps** as the living backlog: rewrite items when priorities shift and remove them only after the work ships.
- When you pick up a task, copy the relevant bullet into your working notes and expand it with acceptance criteria, links, or test plans.
- Keep the touchpoint inventory in sync with reality so new contributors always see which surfaces we currently drive.

## Completed (Today)
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
2. Audit session layouts for lingering inline spacing overrides and queue migrations onto `sessionLayoutTheme` where practical.

### Output Touchpoint Inventory (Current)
1. Surface torch availability and instrumentation feedback in the UI (fallback messaging + metrics).
2. Document the offset-tuning workflow and expose the knobs inside the developer console.
3. Publish a short guide summarising the new `outputs.*` trace metrics (latency, source counts) so offset tuning is data-driven.

### Output Architecture Preparation
1. Persist console filter/search state once developer mode toggles survive reloads.
2. Prototype segmented trace buffers versus the current 200-event ring before raising history limits.
3. Explore file-based or streaming exports so long developer sessions are not limited by the Share sheet payload size.
4. Add a Settings › Output card (below Language) linking to an output settings screen covering audio volume, tone frequency, vibration intensity, and screen flash brightness—with room to extend later.

### Outputs Service Rewire (STOP - Research & Plan)
1. Pause implementation to research platform constraints (Expo Audio/Haptics, flashlight APIs) and outline the risks of low-latency playback across devices.
2. Produce a written implementation plan (data flow, sequencing, fallbacks) for rewiring remaining outputs through the service before coding.

### Developer Mode Shell
1. Publish an offset-tuning walkthrough (linking the new metrics to recommended baselines) so the team can calibrate devices consistently.
2. Add timeline filtering/pinning in the console (time range, event bookmarks) to make long trace sessions easier to audit.
3. Support saving/loading manual pattern presets so testers can jump between common sequences without retyping.

### Practice-Tab Groundwork
1. Inventory the shared components the practice tab will reuse (keyboards, summary cards, toggles) and confirm each has tokens/theming hooks.
2. Define navigation and data scaffolding for practice flows so future tasks are additive rather than structural.
3. Collect and log practice-content ideas/TODOs in a dedicated subsection of this file or companion doc.

### Hygiene & Guardrails
1. Extend docs with session UI conventions and outputs service architecture notes so new contributors follow the same patterns.
2. Prepare an Expo smoke-test checklist (send, receive, summary) to run after major changes and link it in this doc.
3. Add simple mocks/tests around the outputs service to protect against regressions during future rewrites.
4. Integrate `npm run check:session-controls` into CI so the spacing guard runs automatically (not just locally).






























