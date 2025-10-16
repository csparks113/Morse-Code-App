# Outputs Diagnostics Log

## Current Status (2025-10-17)
- Keyer flashes once again drive the native `ScreenFlasherView`: Nitro’s `OutputsAudio` exports synchronous overlay toggles, `utils/audio.ts` propagates the boolean return, and the keyer service falls back to JS only when the dispatcher declines.
- `NativeOutputsDispatcher` reattaches the overlay on `onActivityResumed`, keeps it behind the React content, and `ScreenFlasherView` is input-transparent, so native flashes persist across most session transitions without blocking UI.
- We still see intermittent overlay dropouts after quitting a session early; the next press logs `nativeOverlay:false` and Nitro falls back to JS even though `ensureOverlayView` should have recovered. Need additional instrumentation around detach/attach to understand the failure.
- Brightness boost now stays engaged across native toggles (we only disable it when Nitro turns the overlay off), torch remains disabled while we stabilise the overlay path.
## Immediate Focus
- Instrument the dispatcher to capture attach/detach state when sessions end early (especially `cutActiveOutputs`) and confirm whether `setFlashOverlayState(true, …)` is returning false after a premature exit.
- Add the native `awaitReady(timeout)` guard so Nitro only reports success once the view is attached and visible; on timeout, log the failure and fall back to JS for that playback.
- Export `NativeOutputsDispatcher` as a TurboModule so JS can bind directly, keeping the Nitro path primary but avoiding noisy warnings when Nitro isn’t available.
- After the above fixes, rerun 10/20/30 WPM sweeps plus keyer smoke tests to validate `nativeFlashAvailable:true` coverage before moving on to torch re-enable and telemetry surfacing.
## Archived JS Timer Baseline (2025-10-12)
- All console replay logs and timeline CSVs from the JS timer era now live in `docs/logs/Archive/js-timer-replay/`; use them only when referencing the retired compensation path.
- Key findings from that dataset: guard soak forced most pulses into timeline fallback, `scheduleSkewMs` sat in the 80-120 ms band (peaking above 300 ms), and stale receive replays inflated several analyzer means into multi-second territory.
- If we need to revisit that behaviour, load the archived logs with the pre-dispatcher analyzer; they no longer represent expected output for the native path.

## Testing Recipes
- Play Pattern via developer console remains the primary replay harness; capture tone/flash/haptic deltas plus native dispatch telemetry for every meaningful change.
- Follow each sweep with the freeform send-lesson replay to confirm keyer tolerances and verdict buffers still respect the new scheduling pipeline.
- Archive validated logcat captures under dated folders and update both this log and `docs/outputs-alignment-notes.md` with the summarized deltas.

