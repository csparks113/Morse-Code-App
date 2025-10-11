# Console Replay Summary — 2025-10-10

- **Source**: Developer console Play Pattern (`EXPO_FORCE_NITRO_OUTPUTS=1`)
- **Unit**: 40 ms (dots) / 120 ms (dashes)
- **Highlights**:
  - `outputs.flashPulse.commit` latencies track `timelineOffsetMs` within ~5–15 ms across the sweep.
  - Highest observed native offset: ~90 ms (symbol index 8); corresponding commit latency 98 ms (spike trace not emitted—below 100 ms threshold).
  - Torch channel now reports `timelineOffsetMs`; `touchToTorch` latencies range 53–58 ms once offsets applied.
- **Notes**:
  - No `playMorse.nativeOffset.spike` trace fired (offsets never exceeded 100 ms). If we want to capture the 90 ms range, consider lowering the spike threshold or expanding logging when jump delta >1.
  - Sequence remained monotonic (no reset warnings) during this sweep.

```
| Index | Symbol | Native Offset (ms) | Commit Latency (ms) |
|-------|--------|--------------------|---------------------|
| 0     | .      | 14.3               | 64.1                |
| 1     | .      | 43.3               | 56.6                |
| 2     | .      | 62.5               | 58.6                |
| 3     | -      | 87.6               | 56.3                |
| 4     | -      | 27.2               | 57.5                |
| 5     | -      | 9.3                | 53.2                |
| 6     | .      | 16.9               | 78.8                |
| 7     | .      | 64.4               | 56.0                |
| 8     | .      | 90.0               | 98.4                |
```

Raw log: `docs/logs/console-replay-20251010-aligned.txt`
