### Using This Log
- Capture each day's finished work in **Completed (Today)** so anyone skimming the file can see what moved recently.
- Treat **Next Steps** as the living backlog: rewrite items when priorities shift and remove them only after the work ships.
- When you pick up a task, copy the relevant bullet into your working notes and expand it with acceptance criteria, links, or test plans.
- Keep the touchpoint inventory in sync with reality so new contributors always see which surfaces we currently drive.

## Completed (Today)
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
| `useSendSession` | `OutputsService.flashPulse` & `hapticSymbol`; `playMorse` for replay loops | `signalTolerancePercent`, `gapTolerancePercent`, `getMorseUnitMs()` | Replay sticks with idle timeout + gap classifiers; tracing stays TODO until the developer console lands. |
| `useReceiveSession` | `OutputsService.flashPulse`, `hapticSymbol`, `playMorse` for target playback | `flashOffsetMs`, `hapticOffsetMs`, `getMorseUnitMs()` | Currently un-instrumented; relies on offsets to mask hardware latency. |
| `useKeyerOutputs` + `KeyerButton` | `OutputsService.createKeyerOutputs` sidetone + haptics + flash + torch | `toneHz`, `audioEnabled`, `lightEnabled`, `torchEnabled`, monotonic press timestamps | Emits `keyer.*` trace events (press start/stop, tone/flash/haptics/torch) when developer-mode tracing is enabled; shared helper normalizes timestamps. |
| `services/outputs/defaultOutputsService` | Shared flash/haptics/audio helpers plus keyer handle | `computeFlashTimings`, `clampToneHz`, optional `prepare()` warm-up | Torch acquisition released via guard; logs warm-up latency and torch toggles for developer traces. |

## Next Steps

### Session UI Cleanup
1. Observe the new spacing/color guard over the next few session updates and expand it beyond `components/session` once the signal stays clean.
2. Audit session layouts for lingering inline spacing overrides and queue migrations onto `sessionLayoutTheme` where practical.

### Output Touchpoint Inventory (Current)
1. Verify the matrix above matches current code (send, receive, keyer, console) and patch any drift.
2. Capture remaining touchpoint quirks (torch availability, haptic offsets, etc.) so the rewire plan starts from a single source of truth.
3. Flag any instrumentation gaps that need developer-mode coverage before we broaden the tooling.

### Output Architecture Preparation
1. Add console-side affordances (filters, auto-scroll, export) so trace analysis scales beyond raw log dumps.
2. Compare buffer strategies (ring vs. aggregated segments) to keep long developer sessions responsive.
3. Extend instrumentation to replay (`playMorse`) so we can correlate live keyer latency with playback latency.

### Outputs Service Rewire (STOP — Research & Plan)
1. Pause implementation to research platform constraints (Expo Audio/Haptics, flashlight APIs) and outline the risks of low-latency playback across devices.
2. Produce a written implementation plan (data flow, sequencing, fallbacks) for rewiring remaining outputs through the service before coding.

### Developer Mode Shell
1. Extend the developer console with manual output triggers (audio, flash, haptics, torch) and live filters before exposing it to wider QA.
2. Add a short doc snippet covering the unlock gesture + console route so new contributors can enable the tools quickly.
3. Surface developer entry points outside settings once the unlock flow stabilises (e.g., long-press on lesson header).

### Practice-Tab Groundwork
1. Inventory the shared components the practice tab will reuse (keyboards, summary cards, toggles) and confirm each has tokens/theming hooks.
2. Define navigation and data scaffolding for practice flows so future tasks are additive rather than structural.
3. Collect and log practice-content ideas/TODOs in a dedicated subsection of this file or companion doc.

### Hygiene & Guardrails
1. Extend docs with session UI conventions and outputs service architecture notes so new contributors follow the same patterns.
2. Prepare an Expo smoke-test checklist (send, receive, summary) to run after major changes and link it in this doc.
3. Add simple mocks/tests around the outputs service to protect against regressions during future rewrites.
4. Integrate `npm run check:session-controls` into CI so the spacing guard runs automatically (not just locally).





















