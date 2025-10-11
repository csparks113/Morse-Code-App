# Outputs Alignment Notes (2025-10-10)

The console/receive/send flows now consume the Nitro monotonic timeline end-to-end. Symbol timestamps, latency logging, and torch scheduling all run against `monotonicTimestampMs` + `timelineOffsetMs`, so JS latency sampling matches the native schedule.

## Current Snapshot
- Dots/dashes in Play Pattern runs show `outputs.flashPulse.commit` and `touchToTorch` latencies tracking Nitro offsets within ~5–15 ms (see `docs/logs/console-replay-20251010-aligned.md`).
- Torch enable/disable traces (`keyer.torch.start/stop`) fire immediately after presses and emit offsets/metadata for diagnostics.
- `playMorse.nativeOffset.spike` traces trigger when native offsets exceed ≥80 ms, letting us inspect Nitro sequence jumps without digging through raw payloads.

## Remaining Follow-ups
1. Replace the placeholder raw log (`docs/logs/console-replay-20251010-aligned.txt`) with the actual logcat export so future diffs have ground truth.
2. Investigate recurring offset spikes (≥80 ms) with the native team—decide whether to smooth offsets, adjust sequencing, or recalibrate clocks.
3. Re-run the send lesson regression matrix after any native smoothing to confirm offsets stay stable across WPM extremes.
4. Spot-check receive/practice flows post-fix (torch enabled) and archive a representative logcat bundle for comparison.

## Telemetry Checklist
- Keep `playMorse.nativeOffset.spike` traces enabled while debugging spikes; drop the threshold only if lower offsets provide signal.
- Log summaries in `docs/outputs-investigation.md` whenever new regression runs complete so the backlog stays fresh.
