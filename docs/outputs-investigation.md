# Outputs Diagnostics Log

## Current Status (2025-10-17)
- After adding `awaitOverlayReady`, host attach listeners, and cached view resets, native flashes stay active across replay and keyer sessions—even after early exits—while Nitro gracefully falls back to the decor root when the host is still mounting.
- Dispatcher logging now includes `overlay.attach.retry`, `overlay.attach.failed`, and `view_not_attached`, giving us clear telemetry whenever we degrade to JS.
- The JS fallback warning still appears briefly when we clear the cached view, but native coverage returns on the next pulse; torch remains disabled until we rewire it on the Nitro path.
## Immediate Focus
- Prototype configurable flash colour/brightness on the native overlay (and ScreenFlasherView fallback) so the upcoming visual refresh has a path to ship.
- Wire the output-settings flash brightness slider through Nitro and confirm fallbacks honour the same setting.
- Re-enable and validate the torch channel via Nitro now that the overlay lifecycle is stable; capture new reference logs once it's live.
## Archived JS Timer Baseline (2025-10-12)
- All console replay logs and timeline CSVs from the JS timer era now live in `docs/logs/Archive/js-timer-replay/`; use them only when referencing the retired compensation path.
- Key findings from that dataset: guard soak forced most pulses into timeline fallback, `scheduleSkewMs` sat in the 80-120 ms band (peaking above 300 ms), and stale receive replays inflated several analyzer means into multi-second territory.
- If we need to revisit that behaviour, load the archived logs with the pre-dispatcher analyzer; they no longer represent expected output for the native path.

## Testing Recipes
- Play Pattern via developer console remains the primary replay harness; capture tone/flash/haptic deltas plus native dispatch telemetry for every meaningful change.
- Follow each sweep with the freeform send-lesson replay to confirm keyer tolerances and verdict buffers still respect the new scheduling pipeline.
- Archive validated logcat captures under dated folders and update both this log and `docs/outputs-alignment-notes.md` with the summarized deltas.


