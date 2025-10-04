# Codex Handoff Log

Use this document to capture the single source of truth after each working session. Update the sections below before ending work so future chats can resume without reconstructing context.

## Current Focus
- **Initiative:** Outputs rewire - Foundations & Benchmarks
- **Objective:** Validate dependency compatibility (react-native-audio-api, react-native-nitro-haptics) and baseline touch-to-output latency (tone/haptic/flash/torch).
- **Owner:** Codex pairing session (update with your initials if another contributor takes over).

## Latest Update
- **When:** 2025-10-03 (evening)
- **Summary:** Validated latency instrumentation on the Galaxy S22+ dev client; flash and haptic paths respond in ~1-6 ms, but `react-native-audio-api` sidetone still shows 70-200 ms start/stop latency even after resuming during warm-up. Nitro loader now handles missing native bindings gracefully, and the Audio API plugin is back on its foreground-service defaults for further profiling.
- **State:** Device is connected over `adb` with the audio-api backend active; latency results are logged in `docs/refactor-notes.md`. Next work is reducing audio latency or implementing the Nitro native module before flipping the orchestrator.

## Next Steps

1. Investigate the ~80-120 ms sidetone delay on the Galaxy S22+: instrument Audio API native code if needed and capture additional `[audio-api]` timings for comparison.
2. Kick off the Android-only Nitro `OutputsAudio` native module (estimate ~20-24 engineering hours): scaffold the spec implementation, integrate with Oboe/AAudio, and add JS fallbacks.
3. Document recommended torch/wake-lock overrides in `docs/nitro-integration-prep.md` once the Nitro plan is chosen, then wire the full orchestrator.

### Rebuild + Logging Recipe (Galaxy S22+)

1. **Stop Metro** if it is running (`Ctrl+C` in the terminal window that is hosting `npx expo start`).
2. **Reinstall the dev client** (PowerShell from `C:\dev\Morse`):
   ```powershell
   adb uninstall com.csparks113.MorseCodeApp  # optional but keeps things clean
   setx EXPO_USE_NEW_ARCHITECTURE 1
   npx expo run:android --device --variant debug
   ```
   Wait for Gradle to finish and install the fresh build on the S22+.
3. **Restart Metro** in a clean shell (PowerShell or bash from `C:\dev\Morse`):
   ```powershell
   npx expo start --dev-client --clear
   ```
   Leave this session running; use another terminal for log collection.
4. **Capture warm-up + tone logs** (new PowerShell window):
   ```powershell
   adb logcat -c
   adb logcat ReactNativeJS:D ReactNative:W *:S | findstr /R /C:"keyer.prepare" /C:"keyer.tone"
   ```
   Trigger the Developer Console latency tests, then `Ctrl+C` to stop the log stream.
   To drill into the Audio API stages, run a second tail:
   ```powershell
   adb logcat ReactNativeJS:D ReactNative:W *:S | findstr /C:"[audio-api]"
   ```

## Device Smoke Test Checklist
1. Install dependencies with `npm install` and ensure your Expo CLI is logged in.
2. Build the dev client with New Architecture enabled:
   - iOS: `npx expo run:ios --device` (or `--configuration Release` when profiling).
   - Android: `npx expo run:android --device` (use the short project path to avoid Windows MAX_PATH issues).
3. Start the bundler with `npx expo start --dev-client --clear` and connect the device via the Expo dev client.
4. In-app, open the Developer Console -> Latency card and confirm tone samples log `backend=audio-api` after triggering keyer presses.
5. Hold and release the keyer button several times; watch for immediate sidetone start/stop with latency deltas < 15 ms.
6. Trigger a replay (practice/session playback) to ensure the native `playMorse` path runs without falling back to Expo.
7. Capture any anomalies (fallback to Expo, delayed start/stop, console errors) and note results in `docs/refactor-notes.md` under **Completed (Today)** or follow-up tasks.

## Verification
- **Outstanding checks:** Resolve high touch-to-tone latency on hardware and validate the Nitro `OutputsAudio` native implementation once built.
- **Recent checks:** Galaxy S22+ Developer Console latency run (2025-10-03); `npx expo run:android --device` (2025-10-03); `npx tsc --noEmit` (2025-10-03); `npx nitrogen` (generates stubs, 2025-10-03).

## Reference Docs
- `docs/refactor-notes.md` - master backlog and daily log.
- `docs/outputs-rewire-plan.md` - detailed outputs strategy and milestones.
- `docs/developer-console-updates.md` - console instrumentation history.
- `docs/latency-instrumentation-blueprint.md` - touch-to-output telemetry capture plan.
- `docs/nitro-integration-prep.md` - New Architecture + Nitrogen setup checklist.

## Update Checklist (run this before ending a session)
- [ ] Summarize what changed in **Latest Update** (include paths where relevant).
- [ ] Refresh **Next Steps** so the first unchecked item is the next action.
- [ ] Note verification status in **Verification** (tests run, blockers, failing commands).
- [ ] Cross-link affected planning docs if new information was added.
- [ ] Run `npm run verify:handoff` and resolve any failures.

_Tip: Keep entries terse but explicit enough that a new chat can resume work immediately._



