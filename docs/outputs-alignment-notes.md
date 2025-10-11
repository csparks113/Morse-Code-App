# Outputs Alignment Notes (2025-10-10)

The console/receive/send flows now consume the Nitro monotonic timeline end-to-end. Symbol timestamps, latency logging, and torch scheduling all run against `monotonicTimestampMs` + `timelineOffsetMs`, so JS latency sampling matches the native schedule.

## Current Snapshot
- Dots/dashes in Play Pattern runs show `outputs.flashPulse.commit` and `touchToTorch` latencies tracking Nitro offsets within roughly 5-15 ms (see `docs/logs/console-replay-20251010-aligned.md`).
- Torch enable/disable traces (`keyer.torch.start/stop`) fire immediately after presses and emit offsets/metadata for diagnostics.
- `playMorse.nativeOffset.spike` traces trigger when native offsets exceed about 80 ms, letting us inspect Nitro sequence jumps without digging through raw payloads.
- Live keyer telemetry now threads `monotonicTimestampMs`, keeping live sweeps aligned with replay traces and the analyzer output.
- Analyzer now prints a >=80 ms native-offset table on every run and can export comparison CSVs (see `docs/logs/spike-summary-play-pattern-20251011.csv` for the 13:37/14:14/14:41/14:46/14:59/15:02 Play Pattern runs).
- Developer-console flash pulses now dispatch with an 8 ms timeline lead so JS can fire slightly ahead of the audio channel; watch the next sweeps to confirm the mean audio->flash delta tightens.
- `outputs.flashPulse.commit` now logs `scheduleSkewMs` (plus `audioStartHeadroomMs` and `audioStartCompensationMs`) to track how accurately the JS timer hits the target start.
- Flash scheduling now prefers `audioStartMs` when we have ≥12 ms of headroom, sane native skew, and fresh timestamps; otherwise we fall back to the timeline offset and tag traces with `schedulingMode` so we can see when the guard trips.
- 2025-10-11 Play Pattern captures:
  - `docs/logs/console-replay-20251011-120130-play-pattern.txt` lacked native offsets and showed large audio->flash/haptic drift (~312 ms mean).
  - `docs/logs/console-replay-20251011-122422-play-pattern.txt` rerun through the JSON-aware analyzer now lands at audio->flash mean 17.1 ms (p95 69.3 ms), audio->haptic mean 17.0 ms (p95 68.7 ms), and native alignment mean 29.4 ms (p95 86.0 ms) with no spike traces.
  - `docs/logs/console-replay-20251011-133707-play-pattern.txt` captures the aligned baseline (audio->flash mean 20.8 ms, audio->haptic mean 20.3 ms, native delay mean 32.2 ms, p95 90.6 ms) and includes four `playMorse.nativeOffset.spike` events between 80-100 ms on unit lengths 30/34/48.
  - `docs/logs/console-replay-20251011-141417-play-pattern.txt` shows the drift (audio->flash mean 39.5 ms, audio->haptic mean 45.8 ms, flash commit mean 223.6 ms, native alignment mean 42.1 ms, p95 122.1 ms) and expands the spike cluster to 20 traces >= 80 ms across unitMs 60/48/40/34/30 (details in `docs/logs/spike-summary-play-pattern-20251011.csv`).
  - `docs/logs/console-replay-20251011-144151-play-pattern.txt` followed immediately after the drift run and landed at audio->flash mean 24.8 ms (p95 63.7 ms), audio->haptic mean 23.4 ms (p95 63.0 ms), flash commit mean 95.3 ms (p95 135 ms), and native alignment mean 22.9 ms (p95 62.5 ms). Eight offsets >= 80 ms remained (unitMs 30/34/40, max 121.8 ms), pointing to a transient cluster.
  - `docs/logs/console-replay-20251011-144639-play-pattern.txt` stayed on target (audio->flash mean 24.3 ms, p95 58.0 ms; audio->haptic mean 22.6 ms, p95 57.3 ms; flash commit mean 77.5 ms, p95 108 ms; native alignment mean 21.8 ms, p95 57.0 ms) with no offsets >= 80 ms.
  - `docs/logs/console-replay-20251011-145909-play-pattern.txt` continued to hold form (audio->flash mean 24.6 ms, p95 60.4 ms; native alignment mean 22.4 ms, p95 59.2 ms) with four offsets >= 80 ms (unitMs 40, max 94.8 ms).
  - `docs/logs/console-replay-20251011-150200-play-pattern.txt` stayed in band (audio->flash mean 25.7 ms, p95 66.1 ms; audio->haptic mean 24.0 ms, p95 65.4 ms; flash commit mean 76.5 ms, p95 104 ms; native alignment mean 22.7 ms, p95 64.9 ms) with four offsets >= 80 ms (unitMs 40, max 85.2 ms).
  - `docs/logs/console-replay-20251011-152657-play-pattern.txt` captured the post-lead check (audio->flash mean 25.7 ms, p95 75.8 ms; audio->haptic mean 24.5 ms, p95 75.2 ms; flash commit mean 91.3 ms, p95 154 ms; native alignment mean 23.9 ms, p95 74.6 ms) with seven offsets >= 80 ms (unitMs 34/40/48, max 109.8 ms); correlation IDs are listed in the spike summary for deeper inspection.
  - `docs/logs/console-replay-20251011-154840-play-pattern.txt` shows the 8 ms lead plus `audioStartMs` alignment holding mid-20 ms means (audio->flash 24.5 ms mean / 58.1 ms p95; audio->haptic 23.0 ms mean / 57.3 ms p95; flash commit 78.3 ms mean / 123.0 ms p95) while three unitMs 40 symbols still hit >= 80 ms (max 90.6 ms) and one payload omitted `nativeTimestampMs`; `scheduleSkewMs` points to ~62-70 ms of JS timer lag on those spikes.
  - `docs/logs/console-replay-20251011-161229-play-pattern.txt` regressed immediately after the audio clock wiring: audio->flash mean 40.3 ms (p95 119.4 ms), audio->haptic 39.2 ms (p95 118.6 ms), flash commit 140.7 ms (p95 207.0 ms), native alignment mean 40.2 ms (p95 125.0 ms), 18 offsets >= 80 ms (unitMs 34/40/48/60, peak 198.7 ms), and seven payloads lacked `nativeTimestampMs`; the new flash scheduling path likely needs guardrails.
  - `docs/logs/console-replay-20251011-162210-play-pattern.txt` captured only the first 10 symbols (app restart mid-sweep) but shows the baseline returning: audio->flash mean 18.1 ms (p95 33.0 ms), audio->haptic mean 16.1 ms (p95 30.5 ms), flash commit mean 84.4 ms (p95 107.0 ms), native alignment mean 14.4 ms (p95 26.0 ms), zero >=80 ms spikes, and all payloads include `nativeTimestampMs`; rerun with full coverage once the audioStart fix lands.
  - `docs/logs/console-replay-20251011-163246-play-pattern.txt` reflects the post-restart sweep: audio->flash mean 27.1 ms (p95 58.5 ms), audio->haptic mean 25.4 ms (p95 57.7 ms), flash commit mean 78.4 ms (p95 117.0 ms); native alignment mean 24.4 ms (p95 57.3 ms) with four spikes >= 80 ms (unitMs 40 at 114.5/88.8/81.3 ms, unitMs 48 at 121.1 ms) and complete `nativeTimestampMs` coverage—baseline restored but unitMs 40/48 still flirt with the spike threshold.
  - `docs/logs/console-replay-20251011-165958-play-pattern.txt` continues the audioStart pass with a tighter mean: audio->flash 24.9 ms (p95 62.3 ms), audio->haptic 22.9 ms (p95 61.2 ms), flash commit 79.6 ms (p95 113.0 ms); native alignment mean 21.7 ms (p95 60.7 ms) and only two spikes >= 80 ms (unitMs 40 at 83.0 / 81.3 ms) though one payload dropped `nativeTimestampMs`; `scheduleSkewMs` stayed ~60 ms on those spikes.
  - `docs/logs/console-replay-20251011-171837-play-pattern.txt` shows the latest sweep: audio->flash mean 28.0 ms (p95 73.2 ms), audio->haptic mean 26.7 ms (p95 72.5 ms), flash commit mean 83.0 ms (p95 131.0 ms); native alignment mean 26.1 ms (p95 72.0 ms) with six spikes >= 80 ms (unitMs 30 peaking at 120.2 ms, unitMs 34 at 108.9/98.8 ms, unitMs 40 at 83.9 ms) and three missing `nativeTimestampMs`; `scheduleSkewMs` for the spikes ranges 62-142 ms, pointing back to replay batching.
  - `docs/logs/console-replay-20251011-173500-play-pattern.txt` keeps the audioStart wiring active: audio->flash mean 24.6 ms (p95 61.5 ms), audio->haptic mean 23.3 ms (p95 60.8 ms), flash commit mean 94.3 ms (p95 118.0 ms); native alignment mean 22.8 ms (p95 60.3 ms) with four spikes >= 80 ms (unitMs 30 at 86.4 ms, unitMs 40 at 116.0/82.7/80.3 ms) and four missing `nativeTimestampMs`. `audioStartGuard=headroom` triggered with negative headroom and `scheduleSkewMs` ~35-88 ms on those spikes, underscoring the need for tighter scheduling guardrails.
  - `docs/logs/console-replay-20251011-175743-play-pattern.txt` adds another pass: audio->flash mean 26.5 ms (p95 69.0 ms), audio->haptic mean 25.2 ms (p95 68.3 ms), flash commit mean 91.9 ms (p95 127.0 ms); native alignment mean 24.7 ms (p95 72.7 ms) with six spikes >= 80 ms (unitMs 34 at 108.0/96.7/95.8 ms, unitMs 40 at 109.2/92.7/82.1 ms) and four missing `nativeTimestampMs`; `audioStartGuard=headroom` remained in play with `scheduleSkewMs` roughly 58-100 ms, pointing to persistent replay batching skew.
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


  - `docs/logs/console-replay-20251011-144639-play-pattern.txt` stayed on target (audio->flash mean 24.3 ms, audio->haptic mean 22.6 ms, flash commit mean 77.5 ms, native alignment mean 21.8 ms) and produced no offsets = 80 ms.





