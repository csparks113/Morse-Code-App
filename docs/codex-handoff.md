# Codex Handoff Log

Use this document to capture the single source of truth after each working session. Update the sections below before ending work so future chats can resume without reconstructing context.

## Current Focus
- **Initiative:** Outputs rewire - Nitro alignment and orchestration
- **Objective:** Lock in the stabilized outputs pipeline while validating the new send-session UX (auto reveal + verdict buffer) and continuing replay drift + classification follow-up.
- **Owner:** Codex pairing session (update with your initials if another contributor takes over).

## Roles & Responsibilities
- **Product & Device Validation (cspar):** Drives priorities, runs on-device Play Pattern / freeform sweeps, and captures logcat artifacts.
- **Hands-on Implementation (ChatGPT via Codex CLI):** Implements native/JS fixes, updates documentation, and maintains the outputs backlog.
- **Automation & Tooling (Codex CLI harness):** Provides local execution environment, log capture scripts, and build automation support.

## Latest Update
- **When:** 2025-10-09
- **Summary:** Auto-revealed prompts now show the correct answer after wrong send submissions, backed by a 200 ms verdict buffer stored in `constants/appConfig.ts`. Torch teardown now forces an `OFF` command (`forceTorchOff`) after every release (and still logs failures), Morse signal/gap classifiers gained an extended tolerance window, the verdict buffer restarts on new presses, and presses that collide with banner rendering are ignored to prevent audio clicks. Forced output cuts, the keyer release signal, and FlashOverlay updates remain in place.
- **State:** Outputs are stable across send/receive/practice flows. Focus shifts to validating the verdict buffer + deferred scoring + classifier adjustments on real devices while continuing Nitro replay drift and high-WPM classification follow-up.

## Next Steps
1. Capture a new developer-console **Play Pattern** sweep, replace the placeholder export under `docs/logs/console-replay-20251010-aligned.txt`, and note offsets in `docs/outputs-alignment-notes.md`.
2. Run a freeform send-lesson sweep (mix WPMs, dot-led characters, challenge mode) while logging logcat; document verdict buffer, torch reset, and classifier behaviour in `docs/outputs-investigation.md`.
3. Review any `playMorse.nativeOffset.spike` traces collected during those runs; if spikes stay above ~80 ms, package logs so we can investigate the native timeline and track the follow-up in the investigation doc.
4. Keep torch alignment and high-WPM keyer precision on watch during the sweeps, logging anomalies and proposed tweaks back into `docs/refactor-notes.md`.
5. Run the iOS bridgeless checklist once Android validation is locked so we confirm Nitro parity across platforms.

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

- **Outstanding checks:** Device validation of the verdict buffer + deferred scoring + classifier tweaks + torch reset fallback, Nitro replay drift, high-WPM dot/dash misclassification, iOS Nitro parity.
- **Recent checks:** Bridgeless dev client rebuild with Nitro enabled (2025-10-05); outputs force-cut + flash overlay + verdict buffer/tolerance rollout (2025-10-09).

## Reference Docs
- `docs/android-dev-client-testing.md` - investigation log and known issues.
- `docs/refactor-notes.md` - master backlog and daily log.
- `docs/outputs-investigation.md` - active diagnostics notes and testing recipes.
- `docs/developer-console-updates.md` - console instrumentation history.
- `docs/nitro-integration-prep.md` - New Architecture + Nitrogen setup checklist.

## Update Checklist (run this before ending a session)
- [ ] Summarize what changed in **Latest Update** (include paths where relevant).
- [ ] Refresh **Next Steps** so the first unchecked item is the next action.
- [ ] Note verification status in **Verification** (tests run, blockers, failing commands).
- [ ] Cross-link affected planning docs if new information was added.
- [ ] Run `npm run verify:handoff` and resolve any failures.

_Tip: Keep entries terse but explicit enough that a new chat can resume work immediately._
