# Outputs Diagnostics Log

## Current Status (2025-10-13)
- Android now drives screen flash via a native `ScreenFlasherView`; Nitro toggles it through `setFlashOverlayState`, marks `flashHandledNatively`, and keeps the JS overlay as a telemetry fallback.
- Overlay availability now emits `[outputs-native] overlay.availability` transitions, dispatch events report `nativeFlashAvailable`, JS traces log `outputs.flashPulse.nativeFallback`, and the analyzer surfaces availability/fallback counts.
- 2025-10-14 sweeps (`docs/logs/console-replay-20251014-220656-play-pattern.txt`) show 100 % `nativeFlashAvailable`, no JS fallbacks, and `ScreenFlasherView` intensity logs hitting alpha ≈204; the new React `FlashOverlayHost` keeps the native overlay on the background layer while the JS fallback stays available for telemetry.
- `NativeOutputsDispatcher` now resolves the `FlashOverlayHost` background by `nativeID`, caches the host between flashes, and falls back to the decor view with a warning if the React container is missing.
- Keyer-driven flashes route through the same native overlay + brightness boost pipeline as replays; JS overlay only lights up when the dispatcher reports `nativeFlashAvailable=false`, and the slider now reprograms the native brightness percent live.
- Replay torch stays disabled while we validate the overlay baseline; re-enable only after clean 10/20/30 WPM sweeps consistently land <20 ms audio->flash/haptic.
- `scripts/analyze-logcat.ps1` consumes `PlaybackDispatchEvent` telemetry, counts `outputs.flashPulse.nativeHandled`, and reports overlay coverage alongside dispatch-phase totals.
- Keep the reset ritual (`STOP_REPLAY` broadcast -> force-stop app -> relaunch -> `commands.clear()` -> `adb logcat -c`) before every capture until the new pipeline proves it no longer leaks stale receive pulses.
- Flash pulses emit `flashIntensity` plus `nativeFlashHandled` metadata so analyzer runs reflect user brightness and overlay usage.
- Screen brightness boost is now user-toggleable (settings + dev console) and threads through Nitro so native flashes can temporarily raise display brightness while avoiding JS fallback glare.
- Maintain the 30 WPM guard in dev clients until the native-driven outputs hit the <20 ms latency target and torch is back on.
## Immediate Focus
- Tune overlay appearance (alpha/tint) against the new host background and rerun 10 / 20 / 30 WPM sweeps to confirm visibility + 100 % native coverage behind cards/buttons (keyer + replay).
- Re-enable torch via the native dispatcher now that both replay + keyer flows are native; capture send/receive sweeps to validate timing before turning it back on.
- Surface the `nativeFlashAvailable` / intensity stats inside developer tooling so testers can monitor overlay health without dumping logcat.
- Mirror the overlay background/brightness plumbing on iOS using the same host pattern once the Android timings hold.
- Acceptance checklist: <=12 ms mean error on a 200-dot 20 WPM sweep (95p <=16 ms), zero dropped frames during 60 s dot spam, overlay off after app background/resume, and clear visibility at 10% system brightness with boost enabled.
## Archived JS Timer Baseline (2025-10-12)
- All console replay logs and timeline CSVs from the JS timer era now live in `docs/logs/Archive/js-timer-replay/`; use them only when referencing the retired compensation path.
- Key findings from that dataset: guard soak forced most pulses into timeline fallback, `scheduleSkewMs` sat in the 80-120 ms band (peaking above 300 ms), and stale receive replays inflated several analyzer means into multi-second territory.
- If we need to revisit that behaviour, load the archived logs with the pre-dispatcher analyzer; they no longer represent expected output for the native path.

## Testing Recipes
- Play Pattern via developer console remains the primary replay harness; capture tone/flash/haptic deltas plus native dispatch telemetry for every meaningful change.
- Follow each sweep with the freeform send-lesson replay to confirm keyer tolerances and verdict buffers still respect the new scheduling pipeline.
- Archive validated logcat captures under dated folders and update both this log and `docs/outputs-alignment-notes.md` with the summarized deltas.

