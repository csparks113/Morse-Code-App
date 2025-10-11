# Developer Console Enhancements (Oct 2025)

The developer-mode console now exposes a richer toolset for verifying the Nitro-backed Outputs Service and tuning session playback.

## Manual Output Triggers
- Tap **Dot** or **Dash** to fire controlled keyer pulses that honour the current audio, haptic, flash, and torch toggles.
- Manual triggers and tracing controls sit inside a scrollable footer so smaller devices can reach every toggle.
- **Play Pattern** replays any custom Morse string (dots, dashes, spaces) at the configured WPM; **Stop Playback** cancels in-flight runs.
- Flash overlay mirrors screen intensity during manual tests, and `outputs.flashPulse` / `outputs.hapticSymbol` traces capture the source (`console.manual`).

## Persistent Console Preferences
- Manual trigger toggles, pattern text, WPM, and flash/haptic offset fields persist via the developer store.
- Offset inputs write straight to the shared settings store so receive sessions pick up changes without editing code.

## Trace Analysis Upgrades
- Quick filter chips ("Pulses", "Replays", "Keyer") jump to common event groups without manual searching.
- Live stats summarise key counts and average durations for pulse traces, making it easier to baseline offsets per device.
- JSON export, configurable search, and auto-scroll controls remain so you can snapshot buffers for async review.

## Torch Availability Indicator
- The console shows a live torch capability badge so testers know whether torch triggers are available before running manual pulses.

## Unlock Shortcuts
- Long-press the lessons header (DEV badge visible when armed) to open the console instantly once developer mode is enabled through Settings > Developer tools.

## Instrumentation Notes
- `outputs.flashPulse` and `outputs.hapticSymbol` events are emitted by the Outputs Service for every pulse, tagged with `source` metadata (session send/receive, console manual, etc.).
- Keyer press outputs feed the latency store via `recordLatencySample`, so the console latency card reflects live tone/haptic/flash/torch measurements.
- Nitro playback emits `[outputs-audio]` traces for warm-up, playback, and stop events; correlate them with `keyer.*` traces during tuning.

## Known Issues
- **Play Pattern drift**: tone, flash, haptic, and torch cues now trail audio by ~33 ms on average (p95 ~88 ms); keep capturing logs after each native scheduling tweak to verify improvements.
- **Keyer classification**: send mode occasionally mislabels dot-leading sequences at higher WPM; pair console metrics with `keyer.classification` traces while refining thresholds.

Keep this document handy when onboarding contributors or triaging output issues; everything above is in place and ready for further tuning ahead of the Outputs Service rewire.

## Ignore Press Indicator (2025-10-09)
- **Location**: Developer Console → Diagnostics block (beneath the Torch availability badge).
- **Display**: Shows whether `ignorePressRef` is active. When active, the indicator highlights the reason (e.g., `gap.nonIntra`) and the current press ID.
- **Telemetry hook**: The console subscribes to `session.send.ignorePress.set` traces via `traceOutputs`, which now updates a live `ignorePressState` slice in the developer store.
- **Usage**: Lets testers confirm, at a glance, when the send keyer has entered “ignore” mode without scanning logcat. The indicator resets automatically once the session re-enables interaction.
