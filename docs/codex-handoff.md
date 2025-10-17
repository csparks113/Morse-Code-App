# Codex Handoff Log

Use this document to capture the single source of truth after each working session. Update the sections below before ending work so future chats can resume without reconstructing context.

## Current Focus
- **Initiative:** Outputs rewire - native dispatcher takeover
- **Objective:** Shift replay flash/haptic/torch control fully onto the Nitro dispatcher so native callbacks own timing while JS focuses on telemetry; validate with fresh 10/20/30 WPM sweeps before re-enabling torch.
- **Owner:** Codex pairing session (update with your initials if another contributor takes over).

## Latest Update
- **Summary:** Delivered configurable flash appearance end-to-end. The native overlay now renders a tinted layer with gamma-mapped brightness, the JS fallback mirrors the same opacity curve, Nitro pulses honour per-symbol brightness (including overrides), and the settings slider clamps to a 25% floor while migrating persisted values.
- **Key File Touchpoints:**
  - `android/app/src/main/java/com/csparks113/MorseCodeApp/ScreenFlasherView.kt`, `NativeOutputsDispatcher.kt`: apply gamma-adjusted tint blending, reuse cached activity/host safely, and log appearance events with brightness telemetry.
  - `outputs-native/android/c++/OutputsAudio.cpp`: pulse brightness now matches the configured percentage (no more 100% hard code) and exposes override hooks for JS.
  - `components/session/FlashOverlay.tsx`, `FlashOverlayHost.tsx`, `services/outputs/defaultOutputsService.ts`, `services/outputs/nativeFlashOverlay.ts`, `utils/audio.ts`: mirrored opacity logic for the fallback overlay, threaded brightness/appearance overrides through Nitro + JS, and clamped the slider/storage to the new 25% floor.
  - Docs (`docs/refactor-notes.md`, `docs/outputs-investigation.md`, `docs/living-spec.md`, `README.md`): captured the new behaviour and repositioned follow-up work.
- **State:** Send and receive flashes now share the same native brightness curve and respect the settings slider; Nitro logs confirm both paths run at the configured percentage. Torch remains on the fallback path and timing spikes are still visible in receive replays.

## Next Steps
1. Rewire the torch channel on Nitro (respect the settings toggle, capture reference logs, then mirror on iOS).
2. Reduce Nitro timing spikes so receive/send Play Pattern sweeps keep tone/flash/haptic/torch within ~5 ms.
3. Audit the send verdict pipeline once timing stabilises; resolve inconsistent scoring on long presses/high WPM.
4. Plan the iOS parity pass (overlay, brightness, torch) once Android work lands and hardware is available.
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



