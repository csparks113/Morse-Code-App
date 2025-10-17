# Outputs Diagnostics Log

## Current Status (2025-10-17)
- Configurable flash brightness/tint now flows end-to-end: Android `ScreenFlasherView` blends the tint with gamma-adjusted brightness, the JS fallback mirrors the overlay, Nitro pulses honour per-symbol brightness (including overrides), and the settings slider clamps to a 25% floor while migrating stored values.
- Brightness telemetry (`flashIntensity`, `brightnessPercent`, `flashPath`) is logged for both send and receive paths so we can confirm native coverage and spot fallback regressions quickly.
- Torch remains disabled on Nitro; receive/send flashes are native but still show timing spikes (~160 ms) in `playMorse.nativeOffset.spike`, and send verdict timing continues to rely on the older heuristics.
## Immediate Focus
- Re-enable the torch channel via Nitro dispatch (respect the settings toggle, log availability, and capture a fresh reference run once hardware pulses are native again).
- Reduce timing spikes by tightening the dispatch schedule and adaptive leads so receive audio/flash gaps no longer blur at 80 ms dot units.
- Revisit send verdict timing and classification rules after timing fixes land so question outcomes align across edge cases.
- Queue an iOS parity pass (native overlay + torch) once Android work solidifies.
## Archived JS Timer Baseline (2025-10-12)
- All console replay logs and timeline CSVs from the JS timer era now live in `docs/logs/Archive/js-timer-replay/`; use them only when referencing the retired compensation path.
- Key findings from that dataset: guard soak forced most pulses into timeline fallback, `scheduleSkewMs` sat in the 80-120 ms band (peaking above 300 ms), and stale receive replays inflated several analyzer means into multi-second territory.
- If we need to revisit that behaviour, load the archived logs with the pre-dispatcher analyzer; they no longer represent expected output for the native path.

## Testing Recipes
- Play Pattern via developer console remains the primary replay harness; capture tone/flash/haptic deltas plus native dispatch telemetry for every meaningful change.
- Follow each sweep with the freeform send-lesson replay to confirm keyer tolerances and verdict buffers still respect the new scheduling pipeline.
- Archive validated logcat captures under dated folders and update both this log and `docs/outputs-alignment-notes.md` with the summarized deltas.


