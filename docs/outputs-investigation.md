# Outputs Diagnostics Log

## Current Status (2025-10-10)
- `forceCutOutputs` now runs on every verdict queue/complete transition, session start/stop, and interaction disable so tone/flash/haptics release immediately even if a release handler misses.
- Flash overlay sits behind send/receive/practice UI layers while remaining visible on every surface; brightness tuning may still be needed for low-luminance devices.
- Send prompt card now auto-reveals the answer after wrong submissions, and a 200 ms verdict buffer (from `constants/appConfig.ts`) keeps judgement aligned with the banner animation.
- Torch release now falls back to a hard `forceTorchOff()` after every forced cut (with error logging) and signal/gap classifiers gained an extended tolerance window to stop premature wrong verdicts on dot-led characters.
- Verdict buffer now restarts whenever the user begins a new press, preventing premature verdicts while an answer is still being keyed.
- Added a verdict-finalizing guard so inputs that collide with the banner render no longer trigger audible click artifacts.
- Send verdict scoring now happens at banner display: we schedule the verdict but re-read the full input just before showing the banner so extra dots/dashes can no longer sneak through.
- Developer console now surfaces the live `ignorePressRef` indicator (reason + press ID) via the outputs trace stream, so testers can catch ignore-mode transitions without scanning logcat.
- Developer console replay pulses now schedule against the Nitro monotonic timeline (`monotonicTimestampMs` + native offsets), so JS dispatch no longer inflates latency metrics.
- Torch scheduling/telemetry now use the same monotonic baseline (`timelineOffsetMs`) as flash/haptic, keeping `touchToTorch` latency samples aligned with Nitro offsets (~50-60 ms after adjustment).
- Manual validation now centers on Play Pattern captures plus the freeform send-lesson sweep; see **Testing Recipes** below for the streamlined workflow.

## Latest Observations (2025-10-09 device run)
- `keyer.forceCut` now fires for every verdict transition, and the new keyer release signal resets the button + outputs between questions.
- Receive/practice/send screens all respect the background flash layer; overlay opacity matches brightness settings.
- Nitro logcat stream is quiet once Hermes build prerequisites (DIA SDK) are satisfied.
- Verdict buffer keeps tone/flash cuts synced with the verdict banner on Pixel 7; need additional device checks for WPM extremes.
- Torch reset fallback continues to clear hardware state after forced cuts; keep spot-checking mis-timed releases, but no regressions observed after the timeline alignment.
- Console replay (2025-10-10) shows `outputs.flashPulse.commit` latency closely tracking native offsets (~50-110 ms) while `timelineOffsetMs` is logged; persistent spikes (>150 ms) correlate with Nitro-reported offsets rather than JS delay.
- New `playMorse.nativeOffset.spike` traces surface Nitro offset jumps (>=80 ms) so we can inspect sequence resets without digging through raw symbol logs.
- Archived console replay summary (`docs/logs/console-replay-20251010-aligned.md`) captures the timeline-aligned sweep; replace the placeholder TXT with the actual logcat export when available.
- Torch latency samples in the same sweep track the timeline offsets (~53-58 ms after adjustment), confirming `touchToTorch` now honors the monotonic schedule.

## Attempt History
| Date | Change / Experiment | Scope | Result | Notes |
|------|---------------------|-------|--------|-------|
| 2025-10-09 | Defer send verdict computation until banner display | hooks/useSendSession.ts | Confirmed | Verdict timer now re-checks the captured input before scoring, guarding against premature wrong/correct states |
| 2025-10-09 | Added torch release fallback + relaxed Morse tolerances | services/outputs/defaultOutputsService.ts, utils/morseTiming.ts | Confirmed | Torch release now logs failures and forces a reset; borderline dots/dashes no longer queue instant verdicts |
| 2025-10-09 | Always hard-reset torch after release | services/outputs/defaultOutputsService.ts, utils/torch.ts | Confirmed | Every forced stop now calls `forceTorchOff()` even after successful release to eliminate the lingering ON state |
| 2025-10-09 | Restart verdict buffer on new press | hooks/useSendSession.ts | Confirmed | Clearing the verdict timer on each press-in ensures the buffer restarts whenever the user continues typing |
| 2025-10-09 | Ignore presses during verdict finalization | hooks/useSendSession.ts | Confirmed | Guards new presses while the banner is finalizing to eliminate forced-cut audio clicks |
| 2025-10-09 | Auto-reveal prompt after wrong verdicts and thread verdict buffer config | hooks/useSendSession.ts, constants/appConfig.ts | Confirmed | Prompt card swaps to compare mode instantly; 200 ms buffer leaves time for banner |
| 2025-10-09 | Reordered FlashOverlay so pulses render behind session UI without hiding controls | components/session/FlashOverlay.tsx | Confirmed | Overlay sits behind header/prompt/keyer on send/receive/practice |
| 2025-10-09 | Added keyer release signal and forced cut on verdict/phase transitions | hooks/useKeyerOutputs.ts, hooks/useSendSession.ts, components/session/KeyerButton.tsx | Confirmed | Button no longer stays latched; outputs drop immediately when verdict queues or session ends |
| 2025-10-08 | Hooked Nitro tone controller to forward gain mid-tone | utils/audio.ts | Confirmed | Device volume follows slider; native gain logs remain useful |
| 2025-10-08 | Captured on-device send/practice sessions with new traces | logging | Captured | Nitro backend active; volume/intensity scalars logged; stuck press reproduced |
| 2025-10-08 | Routed keyer/start verdict paths through `cutActiveOutputs` force-stop API | send session, manual console, settings preview | Superseded | Initial mitigation; replaced by 2025-10-09 force-cut work |
| 2025-10-08 | Added watchdog timer for manual/dev console handles (press timeout auto-cut) | developer console | Pending Validation | Need console/manual validation + latency samples |
| 2025-10-08 | Clamp volume/flash brightness when creating tone controller / flash pulses | outputs service, audio utils | Partial | Scalars propagate (`volume`, `intensity`), audible/visual effect still pending tuning |
| 2025-10-07 | Restored outputs pipeline to respect user volume/flash settings and Nitro offsets | outputs service, utils/audio | Partial | Desktop/simulator OK; continue validating on device |
| 2025-10-10 | Align torch scheduling with monotonic timeline offsets | services/outputs/defaultOutputsService.ts | Confirmed | Torch start/stop traces fire immediately; `touchToTorch` samples track offsets (~55 ms) |

## Next Diagnostics
1. Replace the placeholder console replay export (`docs/logs/console-replay-20251010-aligned.txt`) with a fresh developer-console **Play Pattern** capture and log the offsets in this document plus `docs/outputs-alignment-notes.md`.
2. Run a freeform send-lesson sweep (vary WPM and dot-led characters, include challenge mode) while capturing logcat; note verdict buffer timing, torch resets, and classifier behaviour below.
3. Watch the new `playMorse.nativeOffset.spike` traces; if spikes stay above ~80 ms, bundle representative logs so we can inspect the native timeline together.
4. Verify the forced-cut + watchdog path still records `pressTimeout` lines and never leaves Nitro running after long holds or banner collisions.
5. Optional: once manual validation locks in, add a lightweight automated check (unit test or log assertion) for the developer console `ignorePressRef` indicator.
## Open Questions
- Do we want to increase `flashMaxOpacity` on low-brightness devices now that the overlay sits behind UI?
- Does the 200 ms verdict buffer hold across extreme WPM speeds, or do we need a dynamic scale/override?
- Do the new classifier tolerances impact high-WPM accuracy, or should we introduce per-mode overrides?
- Are there residual torch/haptic edge cases (mid-session toggles, console handles) that the reset fallback still misses?

## Owner / Follow-up
- Primary: Codex session + engineering buddy hand-off.
- Mirror updates back into `docs/refactor-notes.md` once resolved.

## Testing Recipes

### Developer Console Play Pattern
1. With Metro running, clear the log buffer:  
   `adb logcat -c`
2. Start a filtered capture that retains native offsets alongside JS traces:  
   `adb logcat ReactNativeJS:D OutputsAudio:D ReactNative:W *:S ^| findstr /R /C:"keyer\." /C:"outputs" /C:"[outputs-audio]" /C:"playMorse.nativeOffset"`
3. Trigger the console **Play Pattern** sweep (cover the usual WPM presets) while the capture runs.
4. Stop the capture (`Ctrl+C`) and save the full logcat output to `docs/logs/console-replay-<timestamp>.txt`.
5. Run `scripts\analyze-logcat.ps1 -LogFile <path>` to summarize tone/flash/haptic/torch deltas and native offsets, then record highlights in this file and `docs/outputs-alignment-notes.md`.

### Freeform Send-Lesson Sweep
1. Start from a clean logcat buffer:  
   `adb logcat -c`
2. Launch the same filtered capture as above so `[outputs-audio]`, `keyer.*`, and torch traces stay visible.
3. Work through send lessons manually:
   - Mix WPMs (e.g., 12, 18, 22) and include dot-led glyphs (`A`, `F`, `R`) plus challenge mode hearts.
   - Alternate correct and intentionally wrong answers, trigger reveals, and observe the 200 ms verdict buffer.
   - Note any torch lag or lingering audio/flash pulses.
4. Stop the capture and save it to `docs/logs/send-freeform-<timestamp>.txt`, then run `scripts\analyze-logcat.ps1` on the file.
5. Append a short Markdown summary here (verdict timing, classifier notes, anomalies) and mirror key findings in `docs/refactor-notes.md`.
