# Developer Console Enhancements (Oct 2025)

The developer-mode console now exposes a richer toolset for verifying the Outputs Service and tuning session playback.

## Manual Output Triggers
- Tap **Dot** or **Dash** to fire controlled keyer pulses that honor the current audio, haptic, flash, and torch toggles.
- The manual triggers and tracing controls now sit inside a scrollable footer so smaller devices can reach every toggle.
- **Play Pattern** replays any custom Morse string (dots, dashes, spaces) at the configured WPM; **Stop Playback** cancels in-flight runs.
- A Flash overlay mirrors screen intensity during manual tests, and `outputs.flashPulse` / `outputs.hapticSymbol` traces capture the source (`console.manual`).

## Persistent Console Preferences
- Manual trigger toggles, pattern text, WPM, and the new flash/haptic offset fields now persist via the developer store.
- Offset inputs write straight to the shared settings store so receive sessions pick up changes without editing code.

## Trace Analysis Upgrades
- Quick filter chips (“Pulses”, “Replays”, “Keyer”) jump to common event groups without manual searching.
- Live stats summarise key counts and average durations for pulse traces, making it easier to baseline offsets per device.
- JSON export, configurable search, and auto-scroll controls remain, letting you snapshot buffers for async review.

## Torch Availability Indicator
- The console shows a live torch capability badge so testers know whether torch triggers are available before they run manual pulses.

## Unlock Shortcuts
- Long-press the lessons header (DEV badge visible when armed) to open the console instantly once developer mode is enabled through Settings › Developer tools.

## Instrumentation Notes
- `outputs.flashPulse` and `outputs.hapticSymbol` events are now emitted by the Outputs Service for every pulse, tagged with `source` metadata (session send/receive, console manual, etc.).
- Keyer press outputs feed the latency store via `recordLatencySample`, so the console latency card reflects live tone/haptic/flash/torch measurements.
- `playMorse.*` traces extend to replay flows, so you can correlate manual or session playback with pulse telemetry.

Keep this document handy when onboarding contributors or triaging output issues—everything above is in place and ready for further tuning ahead of the Outputs Service rewire.


