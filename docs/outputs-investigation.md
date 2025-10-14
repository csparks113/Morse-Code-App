# Outputs Diagnostics Log

## Current Status (2025-10-13)
- JS now treats dispatcher phases explicitly and forwards replay output toggles into Nitro; Android now exposes a `NativeOutputsDispatcher` for torch/vibration, but we still need to finish native flash control before disabling the JS fallback entirely.
- Replay torch stays disabled while we validate flash/haptic alignment on the upcoming native path; re-enable once clean 10/20/30 WPM baselines consistently land <20 ms.
- `scripts/analyze-logcat.ps1` now ingests `PlaybackDispatchEvent` telemetry and reports scheduled/actual coverage so dispatcher gaps surface immediately.
- Keep the reset ritual (`STOP_REPLAY` broadcast -> force-stop app -> relaunch -> `commands.clear()` -> `adb logcat -c`) before every capture until the new pipeline proves it no longer leaks stale receive pulses.
- Maintain the 30 WPM guard in dev clients until the native-driven outputs hit the <20 ms latency target and torch is back on.
- Maintain the 30 WPM guard in dev clients until the native-driven outputs hit the <20 ms latency target and torch is back on.
## Immediate Focus
## Immediate Focus
- Finish the Android native dispatcher path (flash hardware hook, brightness scaling, torch clean-up) and mirror the approach on iOS once hardware access is ready.
- Capture fresh Play Pattern runs at 10/20/30 WPM (torch still off) once the native path lands, verifying <20 ms audio->flash/haptic and reviewing dispatch-phase coverage.
- Re-enable torch plus SOS/receive validations after the baseline holds, archiving results in this log and `docs/outputs-alignment-notes.md`.
## Archived JS Timer Baseline (2025-10-12)
- All console replay logs and timeline CSVs from the JS timer era now live in `docs/logs/Archive/js-timer-replay/`; use them only when referencing the retired compensation path.
- Key findings from that dataset: guard soak forced most pulses into timeline fallback, `scheduleSkewMs` sat in the 80-120 ms band (peaking above 300 ms), and stale receive replays inflated several analyzer means into multi-second territory.
- If we need to revisit that behaviour, load the archived logs with the pre-dispatcher analyzer; they no longer represent expected output for the native path.

## Testing Recipes
- Play Pattern via developer console remains the primary replay harness; capture tone/flash/haptic deltas plus native dispatch telemetry for every meaningful change.
- Follow each sweep with the freeform send-lesson replay to confirm keyer tolerances and verdict buffers still respect the new scheduling pipeline.
- Archive validated logcat captures under dated folders and update both this log and `docs/outputs-alignment-notes.md` with the summarized deltas.
