# Codex Handoff Log

Use this document to capture the single source of truth after each working session. Update the sections below before ending work so future chats can resume without reconstructing context.

## Current Focus
- **Initiative:** Outputs rewire - native dispatcher takeover
- **Objective:** Shift replay flash/haptic/torch control fully onto the Nitro dispatcher so native callbacks own timing while JS focuses on telemetry; validate with fresh 10/20/30 WPM sweeps before re-enabling torch.
- **Owner:** Codex pairing session (update with your initials if another contributor takes over).

## Latest Update
- **Summary:** Keyer flashes are back on the native path—Nitro’s `OutputsAudio` now exposes synchronous overlay toggles, `utils/audio.ts` forwards the boolean result, and the keyer service prefers the dispatcher before touching the legacy RN module. The dispatcher tracks JS-owned flashes via `mExternalOverlayActive`, so Nitro clean-up no longer kills the overlay mid-press, and `ScreenFlasherView` reattaches on `onActivityResumed` while remaining input-transparent behind the React tree. Remaining gap: after quitting a session early the next run occasionally reports `nativeFlashAvailable=false`; we need deeper instrumentation around attach/detach to understand the dropout.
- **Key File Touchpoints:**
  - `android/app/src/main/java/com/csparks113/MorseCodeApp/NativeOutputsDispatcher.kt`, `ScreenFlasherView.kt`: auto-reattach the overlay on resume, keep it behind the React content, and make the view input-transparent while logging availability.
  - `outputs-native/android/c++/OutputsAudio.cpp`, `.hpp`: expose `setFlashOverlayState`/`setScreenBrightnessBoost`, introduce `mExternalOverlayActive` to avoid tearing down JS-owned flashes, and guard brightness boost during Nitro clean-up.
  - `outputs-native/audio.nitro.ts`, `utils/audio.ts`, `services/outputs/defaultOutputsService.ts`: propagate the synchronous return value, prefer the Nitro dispatcher before the RN bridge, and keep the JS overlay purely as telemetry fallback.
  - Docs (`docs/refactor-notes.md`, `docs/outputs-investigation.md`, this handoff) now reflect the restored keyer path and the remaining intermittent dropout after early session exits.
- **State:** Keyer + playback flashes run natively on Android with brightness boost intact; we still need instrumentation for the post-quit dropout, the `awaitReady` guard, TurboModule export, telemetry surfacing, and eventual torch/iOS parity.

## Next Steps
1. Reproduce the post-quit dropout, capture dispatcher attach/detach logs (`overlay.availability`, `overlay.external.*`), and confirm whether `setFlashOverlayState(true, …)` is returning false after a premature exit.
2. Add the native `awaitReady(timeout)` guard so Nitro only reports success once the view is attached/visible; on timeout fall back to the JS flash and emit structured telemetry.
3. Finish exporting `NativeOutputsDispatcher` as a TurboModule so JS binding no longer depends on the legacy bridge (keep the Nitro path primary).
4. Surface `nativeFlashAvailable` + failure counts in the developer console diagnostics and update the analyzer output once the dropout issue is understood.
5. Capture fresh 10/20/30 WPM sweeps (torch off, brightness boost on) plus keyer holds to validate `nativeOverlay:true`, then continue toward torch re-enable and telemetry work.
6. Mirror the overlay + brightness boost plumbing on iOS once Android is stable, and plan the torch/SOS validation afterwards.
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



