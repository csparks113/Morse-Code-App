# Outputs Diagnostics Log

## Current Status (2025-10-09)
- `forceCutOutputs` now runs on every verdict queue/complete transition, session start/stop, and interaction disable so tone/flash/haptics release immediately even if a release handler misses.
- Flash overlay sits behind send/receive/practice UI layers while remaining visible on every surface; brightness tuning may still be needed for low-luminance devices.
- Send prompt card now auto-reveals the answer after wrong submissions, and a 200 ms verdict buffer (from `constants/appConfig.ts`) keeps judgement aligned with the banner animation.
- Torch release now falls back to a hard `forceTorchOff()` after every forced cut (with error logging) and signal/gap classifiers gained an extended tolerance window to stop premature wrong verdicts on dot-led characters.
- Verdict buffer now restarts whenever the user begins a new press, preventing premature verdicts while an answer is still being keyed.
- Added a verdict-finalizing guard so inputs that collide with the banner render no longer trigger audible click artifacts.
- Send verdict scoring now happens at banner display: we schedule the verdict but re-read the full input just before showing the banner so extra dots/dashes can no longer sneak through.

## Latest Observations (2025-10-09 device run)
- `keyer.forceCut` now fires for every verdict transition, and the new keyer release signal resets the button + outputs between questions.
- Receive/practice/send screens all respect the background flash layer; overlay opacity matches brightness settings.
- Nitro logcat stream is quiet once Hermes build prerequisites (DIA SDK) are satisfied.
- Verdict buffer keeps tone/flash cuts synced with the verdict banner on Pixel 7; need additional device checks for WPM extremes.
- Pending validation: ensure the torch reset fallback clears hardware state immediately when mis-timed presses occur and confirm the relaxed classifier stops cutting off characters like "A".

## Attempt History
| Date | Change / Experiment | Scope | Result | Notes |
|------|---------------------|-------|--------|-------|
| 2025-10-09 | Defer send verdict computation until banner display | hooks/useSendSession.ts | Pending Validation | Verdict timer now re-checks the captured input before scoring, guarding against premature wrong/correct states |
| 2025-10-09 | Added torch release fallback + relaxed Morse tolerances | services/outputs/defaultOutputsService.ts, utils/morseTiming.ts | Pending Validation | Torch release now logs failures and forces a reset; borderline dots/dashes should no longer queue instant verdicts |
| 2025-10-09 | Always hard-reset torch after release | services/outputs/defaultOutputsService.ts, utils/torch.ts | Pending Validation | Every forced stop now calls `forceTorchOff()` even after successful release to eliminate the lingering ON state |
| 2025-10-09 | Restart verdict buffer on new press | hooks/useSendSession.ts | Pending Validation | Clearing the verdict timer on each press-in ensures the buffer restarts whenever the user continues typing |
| 2025-10-09 | Ignore presses during verdict finalization | hooks/useSendSession.ts | Pending Validation | Guards new presses while the banner is finalizing to eliminate forced-cut audio clicks |
| 2025-10-09 | Auto-reveal prompt after wrong verdicts and thread verdict buffer config | hooks/useSendSession.ts, constants/appConfig.ts | Confirmed | Prompt card swaps to compare mode instantly; 200 ms buffer leaves time for banner |
| 2025-10-09 | Reordered FlashOverlay so pulses render behind session UI without hiding controls | components/session/FlashOverlay.tsx | Confirmed | Overlay sits behind header/prompt/keyer on send/receive/practice |
| 2025-10-09 | Added keyer release signal and forced cut on verdict/phase transitions | hooks/useKeyerOutputs.ts, hooks/useSendSession.ts, components/session/KeyerButton.tsx | Confirmed | Button no longer stays latched; outputs drop immediately when verdict queues or session ends |
| 2025-10-08 | Hooked Nitro tone controller to forward gain mid-tone | utils/audio.ts | Confirmed | Device volume follows slider; native gain logs remain useful |
| 2025-10-08 | Captured on-device send/practice sessions with new traces | logging | Captured | Nitro backend active; volume/intensity scalars logged; stuck press reproduced |
| 2025-10-08 | Routed keyer/start verdict paths through `cutActiveOutputs` force-stop API | send session, manual console, settings preview | Superseded | Initial mitigation; replaced by 2025-10-09 force-cut work |
| 2025-10-08 | Added watchdog timer for manual/dev console handles (press timeout auto-cut) | developer console | Pending Validation | Need console/manual validation + latency samples |
| 2025-10-08 | Clamp volume/flash brightness when creating tone controller / flash pulses | outputs service, audio utils | Partial | Scalars propagate (`volume`, `intensity`), audible/visual effect still pending tuning |
| 2025-10-07 | Restored outputs pipeline to respect user volume/flash settings and Nitro offsets | outputs service, utils/audio | Partial | Desktop/simulator OK; continue validating on device |

## Next Diagnostics
1. Add a developer console indicator for `ignorePressRef` / active press IDs to catch future latching without digging through raw logs.
2. Validate the new verdict buffer across low/high WPM drills and ensure banner timing still matches perceived output stops.
3. Stress-test dot-led characters (A, F, R, etc.) at multiple WPMs to confirm the relaxed classifier and deferred verdict logic eliminate premature cut-offs; capture latency + classification traces.
4. Re-run manual/dev-console watchdogs to confirm the new force-cut path still logs `pressTimeout` samples and never leaves Nitro running.
5. Capture a fresh logcat bundle with the verdict buffer, deferred verdict, and torch post-release reset enabled, archive it under `docs/logs/`, and diff against pre-fix traces.
6. Run a focused send lesson regression sweep (low/high WPM, rapid retries, mixed tap patterns like `A ↔ N`) to flush any remaining keyer/output bugs; document findings and new issues here.

## Open Questions
- Do we want to increase `flashMaxOpacity` on low-brightness devices now that the overlay sits behind UI?
- Does the 200 ms verdict buffer hold across extreme WPM speeds, or do we need a dynamic scale/override?
- Do the new classifier tolerances impact high-WPM accuracy, or should we introduce per-mode overrides?
- Are there residual torch/haptic edge cases (mid-session toggles, console handles) that the reset fallback still misses?

## Owner / Follow-up
- Primary: Codex session + engineering buddy hand-off.
- Mirror updates back into `docs/refactor-notes.md` once resolved.
