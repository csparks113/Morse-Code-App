# Outputs Diagnostics Log

## Current Symptoms (2025-10-08)
- Flash overlay patch moves the screen tint behind session UI; pending device confirmation that the header/prompt/keyer remain visible during pulses.
- Nitro tone volume now follows the slider on-device (logs show volume 1.0 and audible change).
- Outputs occasionally stay latched after verdicts; `ignorePressRef` remains true and blocks the next press until a force cut.
## Latest Observations (2025-10-08 log capture)
- `keyer.tone.start` now logs `volume: 1` and the device responds; Nitro gain wiring appears fixed.
- `keyer.flash.start` emits `intensity: 0.7` and the new background layering should place the pulse behind the session UI; awaiting device confirmation after the patch.
- `session.send.ignorePress.set` still fires on auto verdicts with `hadActivePress`: false, so `ignorePressRef` stays true until `keyer.forceCut` clears the latched press.
- New hang sample (`session-send:mgiukloqpbevei8o`) held for ~3991 ms without a `queueVerdict` log; the press only cleared after `keyer.forceCut`, matching the stuck outputs symptom.
- Force cuts continue to trigger after long holds, so outputs do eventually clear, but the interaction feels stuck until the cut lands.
## Attempt History
| Date | Change / Experiment | Scope | Result | Notes |
|------|---------------------|-------|--------|-------|
| 2025-10-09 | Reordered FlashOverlay so pulses render behind session UI without hiding controls | components/session/FlashOverlay.tsx | Pending | Await device confirmation that the overlay is visible again |
| 2025-10-08 | Hooked Nitro tone controller to forward gain mid-tone | utils/audio.ts | Confirmed | Device volume now follows the slider; native gain logs still useful for regression checks |
| 2025-10-08 | Captured on-device send/practice sessions with new traces | logging | Captured | Nitro backend active; volume/intensity scalars logged; stuck press reproduced |
| 2025-10-08 | Routed keyer/start verdict paths through `cutActiveOutputs` force-stop API | send session, manual console, settings preview | ?? Partial | `keyer.forceCut` fires, but long presses persist until next session |
| 2025-10-08 | Added watchdog timer for manual/dev console handles (press timeout auto-cut) | developer console | ?? Pending | Need console/manual validation + latency samples |
| 2025-10-08 | Clamp volume/flash brightness when creating tone controller / flash pulses | outputs service, audio utils | ?? Partial | Scalars propagate (`volume`, `intensity`), audible/visual effect still missing |
| 2025-10-07 | Restored outputs pipeline to respect user volume/flash settings and Nitro offsets | outputs service, utils/audio | ?? Pending | Desktop/simulator OK, device regressions persist |

## Next Diagnostics
1. Ship the FlashOverlay z-order fix to a device and confirm the screen flash is visible; tweak `flashMaxOpacity` if it still feels too subtle.
2. Add a simple developer indicator (UI or console) that mirrors `ignorePressRef` and the active press ID so we can see when latching occurs.
3. Exercise the watchdog/manual console paths to ensure `keyer.watchdog.pressTimeout` still fires and cuts outputs quickly.
4. Leave Nitro volume logging enabled for a few more sessions to guard against regressions while we adjust envelopes.
5. Keep capturing logcat + JS traces for any remaining latched-press scenarios and add tests once fixes land.

## Open Questions
- After the z-order fix, do we need to bump `flashMaxOpacity` to make the screen flash feel obvious without washing out the UI?
- What additional conditions keep `ignorePressRef` latched when `hadActivePress` is false, and should we auto-clear it sooner?
- Are there any residual output channels (torch/haptics) that need guardrails when torch is disabled mid-session?

## Owner / Follow-up
- Primary: Codex session + engineering buddy hand-off.
- Mirror updates back into `docs/refactor-notes.md` once resolved.

