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
- Torch scheduling/telemetry now use the same monotonic baseline (`timelineOffsetMs`) as flash/haptic, keeping `touchToTorch` latency samples aligned with Nitro offsets (~50–60 ms after adjustment).

## Latest Observations (2025-10-09 device run)
- `keyer.forceCut` now fires for every verdict transition, and the new keyer release signal resets the button + outputs between questions.
- Receive/practice/send screens all respect the background flash layer; overlay opacity matches brightness settings.
- Nitro logcat stream is quiet once Hermes build prerequisites (DIA SDK) are satisfied.
- Verdict buffer keeps tone/flash cuts synced with the verdict banner on Pixel 7; need additional device checks for WPM extremes.
- Torch reset fallback continues to clear hardware state after forced cuts; keep spot-checking mis-timed releases, but no regressions observed after the timeline alignment.
- Console replay (2025-10-10) shows `outputs.flashPulse.commit` latency closely tracking native offsets (~50-110 ms) while `timelineOffsetMs` is logged; persistent spikes (>150 ms) correlate with Nitro-reported offsets rather than JS delay.
- New `playMorse.nativeOffset.spike` traces surface Nitro offset jumps (>=80 ms) so native folks can inspect sequence resets without digging through raw symbol logs.
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
1. Run the send lesson regression sweep via `node scripts/run-send-regression.js`, logging every matrix scenario below and archiving supporting device captures.
2. Validate the 200 ms verdict buffer across low/high WPM drills while running the sweep, ensuring banner timing still matches perceived output stops.
3. Stress-test dot-led characters (A, F, R, etc.) at multiple WPMs to confirm the relaxed classifier and deferred verdict logic eliminate premature cut-offs; capture latency + classification traces.
4. Re-run manual/dev-console watchdogs to confirm the new force-cut path still logs `pressTimeout` samples and never leaves Nitro running.
5. Replace the placeholder console replay log (`docs/logs/console-replay-20251010-aligned.txt`) with the actual logcat export for future diffs.
6. Capture a fresh logcat bundle with the verdict buffer + torch reset enabled and the new timeline scheduling, then diff against pre-fix traces.
7. Review the new `playMorse.nativeOffset.spike` traces (or lack thereof) to confirm offset magnitudes and share any recurrent patterns with the native team; adjust the spike threshold if offsets stay below 80 ms but still worth tracking.
8. Review regression findings, file any new issues, and mirror key updates back into this log and `docs/refactor-notes.md`.
9. Optional: Add automated checks or unit coverage around the developer console ignore-press indicator once the manual pass confirms behaviour.
## Open Questions
- Do we want to increase `flashMaxOpacity` on low-brightness devices now that the overlay sits behind UI?
- Does the 200 ms verdict buffer hold across extreme WPM speeds, or do we need a dynamic scale/override?
- Do the new classifier tolerances impact high-WPM accuracy, or should we introduce per-mode overrides?
- Are there residual torch/haptic edge cases (mid-session toggles, console handles) that the reset fallback still misses?

## Owner / Follow-up
- Primary: Codex session + engineering buddy hand-off.
- Mirror updates back into `docs/refactor-notes.md` once resolved.

## Send Lesson Regression Matrix (Draft - 2025-10-09)
Run each scenario with device logging enabled (see **Log Capture Recipe** below). For every row record whether the verdict buffer timing felt correct, whether any outputs latched, and any audible/visual glitches (especially keyer “clicks”). Add observations beneath the table or inline in the “Notes” column.

| Scenario ID | Prompt Pattern | User Input Pattern | WPM | Notes to Capture |
|-------------|----------------|--------------------|-----|------------------|
| S1 | Expected `A (.-)` | User taps `A` correctly | 12 | Baseline: confirm banner timing + outputs cut |
| S2 | Expected `N (-.)` | User taps `A (.-)` | 12 | Validate verdict delay + no premature cut-off |
| S3 | Expected `A (.-)` | User taps `N (-.)` | 12 | Confirm buffer restarts when finishing wrong pattern |
| S4 | Expected `A (.-)` | User taps `A`, then immediate retry (tap Start -> `A` again) | 12 | Watch for lingering press state |
| S5 | Expected alternating prompts (`A`, `N`, `R`) | User intentionally alternates (`A↔N`) | 20 | High WPM stress test |
| S6 | Expected practice set with longer glyphs (`K`, `R`, `F`) | User performs rapid retries (`A` twice, `N`, `A`) | 20 | Ensure classifier tolerances hold at high speed |
| S7 | Challenge mode prompt | User intentionally fails hearts (wrong answer) | 12 | Confirm verdict finalization + heart decrement + torch off |
| S8 | Challenge mode prompt | User answers correctly after reveal | 12 | Validate auto-reveal path + outputs |

Document any new issues in this section and mirror them into `docs/refactor-notes.md` / `Next Diagnostics` as appropriate.

## Log Capture Recipe (Send Lesson Regression)
1. (Optional) Run `node scripts/run-send-regression.js` for an interactive checklist that tags logcat and records scenario notes.
2. Connect device and clear existing buffers:
   ```powershell
   adb logcat -c
   ```
3. Start focused capture filtering for keyer/outputs events while preserving full logs for later diffing:
   ```powershell
   adb logcat ReactNativeJS:D ReactNative:W *:S ^| findstr /R /C:"keyer\." /C:"outputs" /C:"[outputs-audio]" /C:"torch"
   ```
4. Run the regression matrix scenarios above. After each scenario, note timestamps and verdict observations in this document.
5. When finished, stop the capture (`Ctrl+C`) and save the log to `docs/logs/send-regression-20251009.txt` (create new filename per run):
   ```powershell
   adb logcat -d > docs/logs/send-regression-20251009.txt
   ```
6. Attach a short summary (scenario IDs covered, anomalies) under **Send Lesson Regression Matrix**.
