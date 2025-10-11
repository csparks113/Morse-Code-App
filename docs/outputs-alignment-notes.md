# Outputs Alignment Notes (2025-10-10)

The console/receive/send flows now consume the Nitro monotonic timeline end-to-end. Symbol timestamps, latency logging, and torch scheduling all run against `monotonicTimestampMs` + `timelineOffsetMs`, so JS latency sampling matches the native schedule.

## Current Snapshot
- Dots/dashes in Play Pattern runs show `outputs.flashPulse.commit` and `touchToTorch` latencies tracking Nitro offsets within roughly 5-15 ms (see `docs/logs/console-replay-20251010-aligned.md`).
- Torch enable/disable traces (`keyer.torch.start/stop`) fire immediately after presses and emit offsets/metadata for diagnostics.
- `playMorse.nativeOffset.spike` traces trigger when native offsets exceed about 80 ms, letting us inspect Nitro sequence jumps without digging through raw payloads.
- Live keyer telemetry now threads `monotonicTimestampMs`, keeping live sweeps aligned with replay traces and the analyzer output.
- Analyzer now prints a >=80 ms native-offset table on every run and can export comparison CSVs (see `docs/logs/spike-summary-play-pattern-20251011.csv` for the 13:37 vs 14:14 Play Pattern runs).
- 2025-10-11 Play Pattern captures:
  - `docs/logs/console-replay-20251011-120130-play-pattern.txt` lacked native offsets and showed large audio->flash/haptic drift (~312 ms mean).
  - `docs/logs/console-replay-20251011-122422-play-pattern.txt` rerun through the JSON-aware analyzer now lands at audio->flash mean 17.1 ms (p95 69.3 ms), audio->haptic mean 17.0 ms (p95 68.7 ms), and native alignment mean 29.4 ms (p95 86.0 ms) with no spike traces.
  - `docs/logs/console-replay-20251011-133707-play-pattern.txt` captures the aligned baseline (audio->flash mean 20.8 ms, audio->haptic mean 20.3 ms, native delay mean 32.2 ms, p95 90.6 ms) and includes four `playMorse.nativeOffset.spike` events between 80-100 ms on unit lengths 30/34/48.
  - `docs/logs/console-replay-20251011-141417-play-pattern.txt` shows the drift (audio->flash mean 39.5 ms, audio->haptic mean 45.8 ms, flash commit mean 223.6 ms, native alignment mean 42.1 ms, p95 122.1 ms) and expands the spike cluster to 20 traces ≥ 80 ms across unitMs 60/48/40/34/30 (details in `docs/logs/spike-summary-play-pattern-20251011.csv`).
  - `docs/logs/console-replay-20251011-144151-play-pattern.txt` followed immediately after the drift run and returned to the expected window (audio->flash mean 23.4 ms, audio->haptic mean 22.3 ms, flash commit mean 77.3 ms, native alignment mean 21.3 ms). Only three offsets ≥ 80 ms remained (unitMs 40, max 121.8 ms), suggesting the regression was transient.
- 2025-10-11 freeform sweeps:
  - `docs/logs/send-freeform-20251011-120419-sweep.txt` and `docs/logs/send-freeform-20251011-123130-sweep.txt` held audio->flash around 2-3 ms and torch reset around 180/380 ms p95 while telemetry was coming back online.
  - `docs/logs/send-freeform-20251011-133848-sweep.txt` (with monotonic traces + analyzer update) shows audio->flash mean 4.7 ms (p95 18.8 ms), audio->haptic mean 5.5 ms (p95 15.6 ms), torch reset mean 163.7 ms (p95 369 ms), and native delay mean 23.4 ms (p95 56.9 ms). One 1.83 s flash-commit span mapped to a deliberate 1.74 s hold; no dispatch lag detected.
- Patch applied to `services/outputs/trace.ts:46` restored serialized payloads for `[outputs]` logs; future captures should continue to surface `nativeTimestampMs` as long as events include the field.

## Remaining Follow-ups
1. Replace the placeholder raw log (`docs/logs/console-replay-20251010-aligned.txt`) with an actual Play Pattern capture and summarize offsets here once archived.
2. Investigate recurring offset spikes (>= 80 ms) by reviewing the native timeline ourselves; decide whether to smooth offsets, adjust sequencing, or recalibrate clocks.
3. During freeform send-lesson sweeps, confirm offsets stay tight across WPM extremes and log any anomalies in this file.
4. Spot-check receive/practice flows post-fix (torch enabled) and archive a representative logcat bundle for comparison.

## Telemetry Checklist
- Keep `playMorse.nativeOffset.spike` traces enabled while debugging spikes; drop the threshold only if lower offsets provide signal.
- After each Play Pattern or freeform sweep, log summaries in `docs/outputs-investigation.md` so the backlog stays fresh.


