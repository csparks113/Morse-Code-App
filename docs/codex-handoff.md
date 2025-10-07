# Codex Handoff Log

Use this document to capture the single source of truth after each working session. Update the sections below before ending work so future chats can resume without reconstructing context.

## Current Focus
- **Initiative:** Outputs rewire - Nitro alignment and orchestration
- **Objective:** Keep Nitro audio as the default path while eliminating replay drift and high-WPM classification errors.
- **Owner:** Codex pairing session (update with your initials if another contributor takes over).

## Latest Update
- **When:** 2025-10-05
- **Summary:** Bridgeless dev client now ships Nitro `OutputsAudio` by default; documentation and onboarding paths were updated to reflect the Nitro baseline and outstanding tuning work (console replay drift, send keyer misclassification). Audio API fallback remains available only behind env toggles for diagnostics.
- **State:** Android dev client is connected over `adb` with Nitro active; investigation log and README capture current known issues. Next focus is replay alignment and high-WPM keyer accuracy.

## Next Steps
1. Profile developer console **Play Pattern** runs, capture `[outputs-audio]` and `keyer.*` logs, and record tone vs flash/haptic/torch offsets in `docs/android-dev-client-testing.md`.
2. Tune Nitro replay scheduling and timeline offsets until drift stays within ~5 ms; document before/after traces in the investigation log.
3. Audit dot/dash thresholds at higher WPM, correlate with `keyer.classification` traces, and propose updated heuristics in `services/outputs`.
4. Run the iOS bridgeless checklist to confirm Nitro registration, latency logging, and parity with Android.

### Rebuild + Logging Recipe (Galaxy S22+)
1. **Stop Metro** if it is running (`Ctrl+C` in the terminal hosting `npx expo start`).
2. **Reinstall the dev client** (PowerShell from `C:\dev\Morse`):
   - Use **Visual Studio 2026 Developer PowerShell v18.0.0-insiders** (or manually set `VCINSTALLDIR`, `VSINSTALLDIR`, `DIA_SDK_DIR`, and prepend the MSVC `Hostx64\\x64` bin to `PATH`) before running the Expo build so Hermes can locate the DIA SDK.
   ```powershell
   adb uninstall com.csparks113.MorseCodeApp  # optional but keeps things clean
   setx EXPO_USE_NEW_ARCHITECTURE 1
   EXPO_USE_NEW_ARCHITECTURE=1 npx expo run:android --device --variant debug
   ```
   Wait for Gradle to finish and install the fresh build on the S22+.
3. **Restart Metro** in a clean shell:
   ```powershell
   EXPO_USE_NEW_ARCHITECTURE=1 npx expo start --dev-client --clear
   ```
   Leave this session running; use another terminal for log collection.
4. **Capture Nitro logs** (new PowerShell window):
   ```powershell
   adb logcat -c
   adb logcat ReactNativeJS:D ReactNative:W *:S | findstr /R /C:"keyer.prepare" /C:"keyer.tone"
   ```
   Trigger the Developer Console latency tests, then `Ctrl+C` to stop the log stream.
   To inspect Nitro playback details, run a second tail:
   ```powershell
   adb logcat ReactNativeJS:D ReactNative:W *:S | findstr /C:"[outputs-audio]"
   ```

## Device Smoke Test Checklist
1. Install dependencies with `npm install` and ensure Expo CLI auth is valid.
2. Build the dev client with New Architecture enabled:
   - iOS: `EXPO_USE_NEW_ARCHITECTURE=1 npx expo run:ios --device` (or build via Xcode).
   - Android: `EXPO_USE_NEW_ARCHITECTURE=1 npx expo run:android --device` (keep workspace path short on Windows).
3. Start Metro with `EXPO_USE_NEW_ARCHITECTURE=1 npx expo start --dev-client --clear` and connect the device via the Expo dev client.
4. In-app, open the Developer Console -> Latency card and confirm samples log `backend=nitro`.
5. Hold and release the keyer button several times; verify touch-to-tone latency stays within target bounds and note any drift across channels.
6. Trigger a replay (practice/session playback) and compare Nitro timing against console telemetry; capture offsets if drift appears.
7. Document anomalies in `docs/android-dev-client-testing.md` and mirror follow-up tasks in `docs/refactor-notes.md`.

## Verification
- **Outstanding checks:** Resolve Nitro replay drift and high-WPM dot/dash misclassification; validate iOS Nitro parity.
- **Recent checks:** Bridgeless dev client rebuild with Nitro enabled (2025-10-05); documentation sweep (2025-10-05).

## Reference Docs
- `docs/android-dev-client-testing.md` - investigation log and known issues.
- `docs/refactor-notes.md` - master backlog and daily log.
- `docs/outputs-rewire-plan.md` - outputs strategy and milestones.
- `docs/developer-console-updates.md` - console instrumentation history.
- `docs/nitro-integration-prep.md` - New Architecture + Nitrogen setup checklist.

## Update Checklist (run this before ending a session)
- [ ] Summarize what changed in **Latest Update** (include paths where relevant).
- [ ] Refresh **Next Steps** so the first unchecked item is the next action.
- [ ] Note verification status in **Verification** (tests run, blockers, failing commands).
- [ ] Cross-link affected planning docs if new information was added.
- [ ] Run `npm run verify:handoff` and resolve any failures.

_Tip: Keep entries terse but explicit enough that a new chat can resume work immediately._
