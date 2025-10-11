# Outputs Diagnostics Log

## Current Status (2025-10-11)
- `forceCutOutputs` now runs on every verdict queue/complete transition, session start/stop, and interaction disable so tone/flash/haptics release immediately even if a release handler misses.
- Flash overlay sits behind send/receive/practice UI layers while remaining visible on every surface; brightness tuning may still be needed for low-luminance devices.
- Send prompt card now auto-reveals the answer after wrong submissions, and a 200 ms verdict buffer (from `constants/appConfig.ts`) keeps judgement aligned with the banner animation.
- Torch release now falls back to a hard `forceTorchOff()` after every forced cut (with error logging) and signal/gap classifiers gained an extended tolerance window to stop premature wrong verdicts on dot-led characters.
- Verdict buffer now restarts whenever the user begins a new press, preventing premature verdicts while an answer is still being keyed.
- Added a verdict-finalizing guard so inputs that collide with the banner render no longer trigger audible click artifacts.
- Send verdict scoring now happens at banner display: we schedule the verdict but re-read the full input just before showing the banner so extra dots/dashes can no longer sneak through.
- Developer console now surfaces the live `ignorePressRef` indicator (reason + press ID) via the outputs trace stream, so testers can catch ignore-mode transitions without scanning logcat.
- Developer console replay pulses now schedule against the Nitro monotonic timeline (`monotonicTimestampMs` + native offsets), so JS dispatch no longer inflates latency metrics.
- Live keyer telemetry (`keyer.flash|haptics|tone|press|torch start/stop`) now emits `monotonicTimestampMs`, keeping device sweeps aligned with replay traces and the updated analyzer.
- Torch scheduling/telemetry now use the same monotonic baseline (`timelineOffsetMs`) as flash/haptic, keeping `touchToTorch` latency samples aligned with Nitro offsets (~50-60 ms after adjustment).
- Manual validation now centers on Play Pattern captures plus the freeform send-lesson sweep; see **Testing Recipes** below for the streamlined workflow.
- Analyzer backs out high-offset regressions automatically: `scripts/analyze-logcat.ps1` prints a >=80 ms native-offset table for every run and can export spike summaries (see `docs/logs/spike-summary-play-pattern-20251011.csv` for the 13:37/14:14/14:41/14:46/14:59/15:02 comparison).
- - Developer-console flash pulses now run with an 8 ms timeline lead (`flashPulse` in `services/outputs/defaultOutputsService.ts`), giving JS a small head start to close the audio->flash delta during replays.
- Tried aligning flash scheduling to `audioStartMs`, but the 2025-10-11 16:12 sweep regressed (drift ~40 ms, spikes to 199 ms), so we rolled the code back to timeline offsets and kept the `scheduleSkewMs` telemetry for diagnostics.
- Flash commit traces now log `scheduleSkewMs` so we can see how far the JS timer fires from the planned lead window.

## Latest Observations (2025-10-11 device run)
- Updated JSON analyzer (`scripts/analyze-logcat.ps1`) now digests the restored `[outputs]` payloads and should be treated as the baseline for future captures.
- Play Pattern regression `docs/logs/console-replay-20251011-161229-play-pattern.txt` shows `scheduleSkewMs` between 116-231 ms on every correlation that spiked `nativeOffsetMs` (120-199 ms); the post-restart sweep `docs/logs/console-replay-20251011-163246-play-pattern.txt` still logs 60-135 ms of skew on the remaining unitMs 40/48 spikes.
- `OutputsAudio.getLatestSymbolInfo()` now reports `expectedTimestampMs`, `startSkewMs`, `batchElapsedMs`, `expectedSincePriorMs`, and `ageMs`, and those fields flow through `playMorse.symbol` traces so the analyzer can line them up with `scheduleSkewMs`.
- Added JS-side guardrails so we only honor `nativeExpectedTimestampMs` when we have =12 ms of headroom, sane `nativeStartSkewMs`, and fresh `nativeAgeMs`; otherwise we fall back to the timeline offset and log `schedulingMode=timeline` for analysis.
- Play Pattern replay (`docs/logs/console-replay-20251011-122422-play-pattern.txt`): audio->flash mean 17.1 ms (p95 69.3 ms), audio->haptic mean 17.0 ms (p95 68.7 ms), audio->tone mean 0.72 ms, torch reset mean 176.7 ms (p95 352 ms). Native alignment spans 193 symbols (mean 29.4 ms, p95 86.0 ms) with nativeOffset mean/max 28.9 / 123.0 ms and no spike traces.
- Reprocessed Play Pattern capture (`docs/logs/console-replay-20251011-133707-play-pattern.txt`) aligns with Nitro (audio->flash mean 20.8 ms, audio->haptic mean 20.3 ms, native delay mean 32.2 ms, p95 90.6 ms) but still surfaced four `playMorse.nativeOffset.spike` events between 80-100 ms (unitMs 48/34/30); keep the log flagged while we monitor for clusters.
- Regression Play Pattern capture (`docs/logs/console-replay-20251011-141417-play-pattern.txt`) shows the drift: audio->flash mean 36.7 ms (p95 110.3 ms), audio->haptic mean 35.4 ms (p95 109.6 ms), flash commit mean 435.8 ms, native alignment mean 42.6 ms (p95 117.2 ms), and 20 correlations above 80 ms (unit lengths 60/48/40/34/30). The spike summary CSV lists each correlation ID for follow-up.
- Follow-up sweeps hold the baseline: `docs/logs/console-replay-20251011-144151-play-pattern.txt` (audio->flash mean 24.8 ms, p95 63.7 ms; 8 offsets >=80 ms, all unitMs 30/34/40), `docs/logs/console-replay-20251011-144639-play-pattern.txt` (audio->flash mean 24.3 ms, p95 58.0 ms; 0 offsets >=80 ms), `docs/logs/console-replay-20251011-145909-play-pattern.txt` (audio->flash mean 24.6 ms, p95 60.4 ms; 4 offsets >=80 ms, unitMs 40), `docs/logs/console-replay-20251011-150200-play-pattern.txt` (audio->flash mean 25.7 ms, p95 66.1 ms; 4 offsets >=80 ms, unitMs 40, max 85.2 ms), and `docs/logs/console-replay-20251011-152657-play-pattern.txt` (audio->flash mean 25.7 ms, p95 75.8 ms; 7 offsets >=80 ms across unitMs 34/40/48, max 109.8 ms). The spike summary CSV now compares the baseline 13:37 run, the 14:14 regression, and every recovery sweep (14:41, 14:46, 14:59, 15:02, 15:26).
- 2025-10-11 15:48:40 capture (`docs/logs/console-replay-20251011-154840-play-pattern.txt`): audio->flash mean 24.5 ms (p95 58.1 ms), audio->haptic mean 23.0 ms (p95 57.3 ms), flash commit mean 78.3 ms (p95 123.0 ms); native delay mean 22.0 ms (p95 56.9 ms) with three unitMs 40 offsets >=80 ms (max 90.6 ms) and one symbol missing native timestamps. `scheduleSkewMs` on those spikes ran ~62-70 ms, so the lead is being consumed by JS timer slippage rather than removing the native offset.
- Next replay sweep should capture the new native skew metrics so we can see how much of the spike budget is JS timer slippage versus native batching; keep logging analyzer output to confirm.
- Next focus: explore native-side scheduling tweaks (e.g., shorter batch window or priority queue) once the new `startSkewMs` / `batchElapsedMs` telemetry confirms where the delay lives.
- Freeform send sweep (`docs/logs/send-freeform-20251011-133848-sweep.txt`): audio->flash mean 4.7 ms (p95 18.8 ms), audio->haptic mean 5.5 ms (p95 15.6 ms), tone mean 0.65 ms, torch reset mean 163.7 ms (p95 369 ms). Haptic->flash spans continue to average ~210 ms (p95 462 ms), and the lone 1.83 s flash-commit window matched a deliberate 1.74 s press hold (torch reset at 5,385,125 ms).
- Prior 2025-10-09 runs still validate the forced-cut + verdict-buffer flow; keep using them as comparison points for high-WPM sweeps until more 2025-10-11 logs accumulate.

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
- 2025-10-11 12:24:22 capture (`docs/logs/console-replay-20251011-122422-play-pattern.txt`): audio->flash mean 17.1 ms (p95 69.3 ms), audio->haptic mean 17.0 ms (p95 68.7 ms), audio->tone mean 0.72 ms, torch reset mean 176.7 ms (p95 352 ms); native alignment mean 29.4 ms (p95 86.0 ms) with nativeOffset mean/max 28.9 / 123.0 ms and no spike traces.
- 2025-10-11 13:37:07 capture (`docs/logs/console-replay-20251011-133707-play-pattern.txt`): audio->flash mean 25.6 ms (p95 75.3 ms), audio->haptic mean 24.4 ms (p95 74.5 ms), flash commit mean 78.6 ms (p95 134 ms); native delay mean 23.4 ms (p95 73.6 ms) plus four `playMorse.nativeOffset.spike` events (80-99 ms) to keep on the watchlist.
- 2025-10-11 14:14:17 capture (`docs/logs/console-replay-20251011-141417-play-pattern.txt`): audio->flash mean 39.5 ms (p95 116.6 ms), audio->haptic mean 45.8 ms (p95 122.9 ms), flash commit mean 223.6 ms (p95 969 ms); native delay mean 42.1 ms (p95 122.1 ms) with offsets peaking at 167.4 ms. Thirteen `playMorse.nativeOffset.spike` events fired (unitMs 60/48/40/34), so bundle this log if the spike cluster persists.
- High-offset correlation summary for both runs lives at `docs/logs/spike-summary-play-pattern-20251011.csv`; analyzer now prints the same table at the end of each invocation.
- 2025-10-11 14:41:51 capture (`docs/logs/console-replay-20251011-144151-play-pattern.txt`): audio->flash mean 24.8 ms (p95 63.7 ms), audio->haptic mean 23.4 ms (p95 63.0 ms), flash commit mean 95.3 ms (p95 135 ms); native delay mean 22.9 ms (p95 62.5 ms) with eight offsets >=80 ms (unitMs 30/34/40, max 121.8 ms). The spike summary CSV includes each correlation ID.
- 2025-10-11 14:46:39 capture (`docs/logs/console-replay-20251011-144639-play-pattern.txt`): audio->flash mean 24.3 ms (p95 58.0 ms), audio->haptic mean 22.6 ms (p95 57.3 ms), flash commit mean 77.5 ms (p95 108 ms); native delay mean 21.8 ms (p95 57.0 ms) with zero offsets >=80 ms, confirming the 14:14 drift was transient.
- 2025-10-11 14:59:09 capture (`docs/logs/console-replay-20251011-145909-play-pattern.txt`): audio->flash mean 24.6 ms (p95 60.4 ms), audio->haptic mean 23.3 ms (p95 59.1 ms), native delay mean 22.4 ms (p95 59.2 ms); four offsets >=80 ms (unitMs 40, max 94.8 ms).
- 2025-10-11 15:02:00 capture (`docs/logs/console-replay-20251011-150200-play-pattern.txt`): audio->flash mean 25.7 ms (p95 66.1 ms), audio->haptic mean 24.0 ms (p95 65.4 ms), flash commit mean 76.5 ms (p95 104 ms); native delay mean 22.7 ms (p95 64.9 ms) with four offsets above 80 ms (unitMs 40, max 85.2 ms).
- 2025-10-11 15:26:57 capture (`docs/logs/console-replay-20251011-152657-play-pattern.txt`): audio->flash mean 25.7 ms (p95 75.8 ms), audio->haptic mean 24.5 ms (p95 75.2 ms), flash commit mean 91.3 ms (p95 154 ms); native delay mean 23.9 ms (p95 74.6 ms) with seven offsets >=80 ms (unitMs 34/40/48, max 109.8 ms).
- 2025-10-11 15:48:40 capture (`docs/logs/console-replay-20251011-154840-play-pattern.txt`): audio->flash mean 24.5 ms (p95 58.1 ms), audio->haptic mean 23.0 ms (p95 57.3 ms), flash commit mean 78.3 ms (p95 123.0 ms); native delay mean 22.0 ms (p95 56.9 ms) with three offsets >=80 ms (all unitMs 40, max 90.6 ms) and one symbol missing `nativeTimestampMs`.
- 2025-10-11 16:12:29 capture (`docs/logs/console-replay-20251011-161229-play-pattern.txt`): audio->flash mean 40.3 ms (p95 119.4 ms), audio->haptic mean 39.2 ms (p95 118.6 ms), flash commit mean 140.7 ms (p95 207.0 ms); native delay mean 40.2 ms (p95 125.0 ms) with 18 offsets >=80 ms (unitMs 34/40/48/60, max 198.7 ms) and seven symbols missing `nativeTimestampMs`. Regression coincides with the audioStart-driven flash scheduling and needs follow-up.
- 2025-10-11 16:32:46 capture (`docs/logs/console-replay-20251011-163246-play-pattern.txt`): audio->flash mean 27.1 ms (p95 58.5 ms), audio->haptic mean 25.4 ms (p95 57.7 ms), flash commit mean 78.4 ms (p95 117.0 ms); native delay mean 24.4 ms (p95 57.3 ms) with four spikes >=80 ms (unitMs 40/48). `scheduleSkewMs` for those correlations landed at 63.9 ms (mgmqg3d4hhbeik40), 134.4 ms (mgmqg892pyemnqc5), 75.8 ms (mgmqg7o4euf7t46k), and 112.5 ms (mgmqg9ul45tkgyqe); all symbols retained `nativeTimestampMs`.
- 2025-10-11 16:22:10 capture (`docs/logs/console-replay-20251011-162210-play-pattern.txt`): only 10 symbols recorded (app restarted mid-run); audio->flash mean 18.1 ms (p95 33.0 ms), audio->haptic mean 16.1 ms (p95 30.5 ms), flash commit mean 84.4 ms (p95 107.0 ms); native delay mean 14.4 ms (p95 26.0 ms) with no offsets >=80 ms and complete native timestamp coverage.
- 2025-10-11 16:59:58 capture (`docs/logs/console-replay-20251011-165958-play-pattern.txt`): audio->flash mean 24.9 ms (p95 62.3 ms), audio->haptic mean 22.9 ms (p95 61.2 ms), flash commit mean 79.6 ms (p95 113.0 ms); native delay mean 21.7 ms (p95 60.7 ms) with two spikes >=80 ms (unitMs 40 at 83.0 / 81.3 ms) and one missing `nativeTimestampMs`. `scheduleSkewMs` stayed in the ~58-66 ms band on the spikes, so guardrails around the audioStart path may still be warranted.
- 2025-10-11 17:18:37 capture (`docs/logs/console-replay-20251011-171837-play-pattern.txt`): audio->flash mean 28.0 ms (p95 73.2 ms), audio->haptic mean 26.7 ms (p95 72.5 ms), flash commit mean 83.0 ms (p95 131.0 ms); native delay mean 26.1 ms (p95 72.0 ms) with six spikes >=80 ms (unitMs 30/34/40, max 120.2 ms) and three missing `nativeTimestampMs`. `scheduleSkewMs` spans 62-142 ms on the spikes; unitMs 30 correlations now show the highest offsets.
- 2025-10-11 17:35:00 capture (`docs/logs/console-replay-20251011-173500-play-pattern.txt`): audio->flash mean 24.6 ms (p95 61.5 ms), audio->haptic mean 23.3 ms (p95 60.8 ms), flash commit mean 94.3 ms (p95 118.0 ms); native delay mean 22.8 ms (p95 60.3 ms) with four spikes >=80 ms (unitMs 30/40, max 116.0 ms) and four missing `nativeTimestampMs`. `audioStartGuard=headroom` fired on the spikes with `scheduleSkewMs` ~35-88 ms and negative headroom, suggesting the audioStart path still overshoots under rapid batching.
- 2025-10-11 17:57:43 capture (`docs/logs/console-replay-20251011-175743-play-pattern.txt`): audio->flash mean 26.5 ms (p95 69.0 ms), audio->haptic mean 25.2 ms (p95 68.3 ms), flash commit mean 91.9 ms (p95 127.0 ms); native delay mean 24.7 ms (p95 72.7 ms) with six spikes >=80 ms (unitMs 34/40, max 109.2 ms) and four missing `nativeTimestampMs`. `audioStartGuard=headroom` continues to trip on the spikes while `scheduleSkewMs` sits between 58-100 ms.
- 2025-10-11 16:32:46 capture (`docs/logs/console-replay-20251011-163246-play-pattern.txt`): audio->flash mean 27.1 ms (p95 58.5 ms), audio->haptic mean 25.4 ms (p95 57.7 ms), flash commit mean 78.4 ms (p95 117.0 ms); native delay mean 24.4 ms (p95 57.3 ms) with four offsets >=80 ms (unitMs 40/48, max 121.1 ms) and full native timestamp coverage. Regression from 16:12 cleaned up after restart but unitMs 40/48 spikes still brush the 80 ms threshold.

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
- 2025-10-11 13:38:48 sweep (`docs/logs/send-freeform-20251011-133848-sweep.txt`): audio->flash mean 4.7 ms (p95 18.8 ms), audio->haptic mean 5.5 ms (p95 15.6 ms), tone mean 0.65 ms (p95 1 ms), torch reset mean 163.7 ms (p95 369 ms); haptic->flash mean 210 ms (p95 462 ms) and the lone 1.83 s flash-commit mapped to a deliberate 1.74 s hold.
- 2025-10-11 14:46:39 capture (`docs/logs/console-replay-20251011-144639-play-pattern.txt`): audio->flash mean 24.3 ms (p95 58.0 ms), audio->haptic mean 22.6 ms (p95 57.3 ms), flash commit mean 77.5 ms (p95 108 ms); native delay mean 21.8 ms (p95 57.0 ms) and no offsets exceeded 80 ms.
- 2025-10-11 14:59:09 capture (`docs/logs/console-replay-20251011-145909-play-pattern.txt`): audio->flash mean 24.1 ms (p95 60.4 ms), audio->haptic mean 22.7 ms (p95 59.7 ms), flash commit mean 77.2 ms (p95 109 ms); native delay mean 21.8 ms (p95 59.2 ms) with two offsets above 80 ms (both unitMs 40).
- 2025-10-11 15:02:00 capture (docs/logs/console-replay-20251011-150200-play-pattern.txt): audio->flash mean 25.7 ms (p95 66.1 ms), audio->haptic mean 24.0 ms (p95 65.4 ms), flash commit mean 76.5 ms (p95 104 ms); native delay mean 22.7 ms (p95 64.9 ms) with four offsets above 80 ms (unitMs 40, max 85.2 ms).

- 2025-10-11 15:26:57 capture (docs/logs/console-replay-20251011-152657-play-pattern.txt): audio->flash mean 25.7 ms (p95 75.8 ms), audio->haptic mean 24.5 ms (p95 75.2 ms), flash commit mean 91.3 ms (p95 154 ms); native delay mean 23.9 ms (p95 74.6 ms) with seven offsets >= 80 ms (unitMs 34/40/48, max 109.8 ms).

