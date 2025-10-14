# Codex Handoff Log

Use this document to capture the single source of truth after each working session. Update the sections below before ending work so future chats can resume without reconstructing context.

## Current Focus
- **Initiative:** Outputs rewire - native dispatcher takeover
- **Objective:** Shift replay flash/haptic/torch control fully onto the Nitro dispatcher so native callbacks own timing while JS focuses on telemetry; validate with fresh 10/20/30 WPM sweeps before re-enabling torch.
- **Owner:** Codex pairing session (update with your initials if another contributor takes over).

## Latest Update
- **Summary:** Android Nitro now mounts a native `ScreenFlasherView` overlay for every playback symbol, drives screen brightness boost through C++/JS, logs overlay availability, and the analyzer tracks native availability/fallback metrics so we can see when JS lighting kicks in.
- **Key File Touchpoints:**
  - `android/app/src/main/java/com/csparks113/MorseCodeApp/NativeOutputsDispatcher.kt`, `ScreenFlasherView.kt`: overlay mount/teardown, `setFlashOverlayState`, brightness boost hook, lifecycle guards, and `[outputs-native] overlay.availability` logging.
  - `outputs-native/android/c++/OutputsAudio.cpp`, `.hpp`: per-symbol overlay toggles, manages `mScreenBrightnessBoostEnabled`, emits `flashHandledNatively`/`nativeFlashAvailable`, logs overlay activation failures, restores fallbacks if overlay unavailable or playback cancels.
  - Nitro bindings (`outputs-native/audio.nitro.ts`, `nitrogen/generated/shared/c++/PlaybackRequest.hpp`, `PlaybackDispatchEvent.hpp`) and JS consumers (`utils/audio.ts`, `services/outputs/*`, hooks, session/practice/lesson surfaces, dev console) forward `screenBrightnessBoost` and the new `nativeFlashAvailable` flag while honouring native-handled flashes.
  - Settings/dev console (`constants/appConfig.ts`, `store/useSettingsStore.ts`, `store/useDeveloperStore.ts`, `app/settings/output.tsx`, `app/dev/index.tsx`) expose the brightness boost toggle with live preview.
  - Analyzer (`scripts/analyze-logcat.ps1`) counts `outputs.flashPulse.nativeHandled`, tracks `nativeFlashAvailable`/`outputs.flashPulse.nativeFallback`, excludes native-handled pulses from latency stats, and reports coverage totals.
  - Docs (`docs/refactor-notes.md`, `docs/outputs-investigation.md`, this handoff) detail the overlay rollout, brightness boost path, and updated backlog.
- **State:** Overlay + brightness boost run natively on Android with JS relegated to telemetry fallback; availability telemetry now logs end-to-end, and we still need to surface the flag in diagnostics, capture validation sweeps, and finish iOS parity before torch/SOS flows return.

## Next Steps
1. Surface the `nativeFlashAvailable` flag in developer console diagnostics so overlay status/fallback counts are visible without parsing logs.
2. Sanity-check the updated analyzer (`nativeFlashAvailable` / `outputs.flashPulse.nativeFallback`) on fresh Play Pattern captures before declaring the overlay path stable.
3. Capture 10/20/30 WPM Play Pattern sweeps (torch off, brightness boost on); verify <20 ms audio->flash/haptic, confirm `nativeFlashAvailable`/`nativeHandled` coverage, archive logs and notes.
4. Mirror the screen-flash overlay + brightness boost plumbing on iOS so both platforms expose the same toggle and telemetry.
5. Once sweeps pass, re-enable torch plus SOS/receive validations, archive the data, and refresh investigation docs.
## Verification
- `npm run lint` *(fails)* - command timed out after ESLint attempted to parse generated bundle artifacts (`..bundle.js`, `..virtual-entry.bundle.js`), which already trigger thousands of legacy lint errors.

1. **Stop Metro** if it is running (`Ctrl+C` in the terminal hosting `npx expo start`).
2. **Reinstall the dev client** (PowerShell from `C:\dev\Morse`):
   - Use **Visual Studio 2026 Developer PowerShell v18.0.0-insiders** (or manually set `VCINSTALLDIR`, `VSINSTALLDIR`, `DIA_SDK_DIR`, and prepend the MSVC `Hostx64\x64` bin to `PATH`) before running the Expo build so Hermes can locate the DIA SDK.
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
   adb logcat ReactNativeJS:D OutputsAudio:D ReactNative:W *:S | findstr /R /C:"keyer.prepare" /C:"keyer.tone"
   ```
   Trigger the Developer Console latency tests, then `Ctrl+C` to stop the log stream.
   To inspect Nitro playback details, run a second tail:
   ```powershell
   adb logcat ReactNativeJS:D OutputsAudio:D ReactNative:W *:S | findstr /C:"outputs-audio"
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
- `docs/android-dev-client-testing.md` " investigation log and known issues.
- `docs/refactor-notes.md` " master backlog and daily log.
- `docs/outputs-investigation.md` " active diagnostics notes and testing recipes.
- `docs/developer-console-updates.md` " console instrumentation history.
- `docs/nitro-integration-prep.md` " New Architecture + Nitrogen setup checklist.

## Update Checklist (run this before ending a session)
- [ ] Summarize what changed in **Latest Update** (include paths where relevant).
- [ ] Refresh **Next Steps** so the first unchecked item is the next action.
- [ ] Note verification status in **Verification** (tests run, blockers, failing commands).
- [ ] Cross-link affected planning docs if new information was added.
- [ ] Run `npm run verify:handoff` and resolve any failures.

_Tip: Keep entries terse but explicit enough that a new chat can resume work immediately._



