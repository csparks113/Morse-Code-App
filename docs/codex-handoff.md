# Codex Handoff Log

Use this document to capture the single source of truth after each working session. Update the sections below before ending work so future chats can resume without reconstructing context.

## Current Focus
- **Initiative:** Outputs rewire - native dispatcher takeover
- **Objective:** Shift replay flash/haptic/torch control fully onto the Nitro dispatcher so native callbacks own timing while JS focuses on telemetry; validate with fresh 10/20/30 WPM sweeps before re-enabling torch.
- **Owner:** Codex pairing session (update with your initials if another contributor takes over).

## Latest Update
- **Summary:** Routed Android torch pulses through the native dispatcher across keyer and replay flows. Nitro playback now drives hardware toggles end-to-end, replay scheduling keeps torch latency aligned with the native flash pipeline, and new `replay.torch.*` traces document the hardware path while Expo remains a guarded fallback.
- **Key File Touchpoints:**
  - `android/app/src/main/java/com/csparks113/MorseCodeApp/ScreenFlasherView.kt`: apply gamma-adjusted tint blending, reuse cached activity/host safely, and log appearance events with brightness telemetry.
  - `android/app/src/main/java/com/csparks113/MorseCodeApp/NativeOutputsDispatcher.kt`, `TorchModule.kt`, `specs/NativeTorchModuleSpec.kt`, `FlashOverlayPackage.kt`: add torch availability logging, synchronous toggle hooks, and TurboModule wiring so Nitro + JS callers can drive hardware pulses natively.
  - `outputs-native/android/c++/OutputsAudio.cpp`: pulse brightness now matches the configured percentage (no more 100% hard code) and exposes override hooks for JS.
  - `components/session/FlashOverlay.tsx`, `FlashOverlayHost.tsx`, `services/outputs/defaultOutputsService.ts`, `services/outputs/nativeFlashOverlay.ts`, `utils/audio.ts`: mirrored opacity logic for the fallback overlay, threaded brightness/appearance overrides through Nitro + JS, and clamped the slider/storage to the new 25% floor.
  - `android/app/src/main/AndroidManifest.xml`: added `WAKE_LOCK` permission so Expo keep-awake hooks stop failing on the dev client.
  - `utils/nativeTorch.ts`, `utils/torch.ts`: prefer the native dispatcher for torch control, keep Expo as a fallback, enforce ref-counted toggles, and harden force-off handling.
  - `hooks/useReceiveSession.ts`, `app/lessons/[group]/[lessonId]/receive.tsx`, `services/outputs/defaultOutputsService.ts`: replay flows now pass the torch toggle through to native playback, schedule torch pulses alongside flashes, and ensure JS only animates when the overlay is unavailable.
  - Docs (`docs/refactor-notes.md`, `docs/outputs-investigation.md`, `docs/living-spec.md`, `README.md`): captured the native torch rollout and outlined the remaining timing, telemetry, and parity work.
- **State:** Android send/replay flashes share the native brightness curve, torch pulses are fully native with Expo as a safety fallback, telemetry covers both keyer and replay hardware pulses, and receive replays still surface ~160 ms timing spikes that must be tightened before we pivot to lessons restructuring.

## Next Steps
1. Capture and archive fresh Play Pattern + receive replay logs (25% and 50% brightness) to baseline torch latency and verify fallback warnings stay quiet on healthy hardware.
2. Reduce Nitro timing spikes to +/- 5 ms by tuning dispatcher leads and adaptive scheduling; update diagnostics once drift drops.
3. Audit the send verdict pipeline (long holds/high WPM) with the stabilised timeline so classifier + verdict clocks stay in sync.
4. Promote flash tint/brightness into shared theme tokens so native and JS overlays read identical values.
5. Map the Android torch work onto iOS (overlay, brightness, torch) once devices are available.
6. With outputs stabilised, shift focus to the lessons restructuring backlog.
## Verification
- Not run (torch requires on-device validation); lint remains blocked by generated Metro bundles until we exclude `..bundle.js` artifacts.

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
   adb logcat ReactNativeJS:D OutputsAudio:D NativeOutputsDispatcher:D ReactNative:W *:S | findstr /R /C:"keyer.prepare" /C:"keyer.tone" /C:"torch.availability"
   ```
   Trigger the Developer Console latency tests, then `Ctrl+C` to stop the log stream.
   To inspect Nitro playback details, run a second tail:
   ```powershell
   adb logcat ReactNativeJS:D OutputsAudio:D NativeOutputsDispatcher:D ReactNative:W *:S | findstr /C:"outputs-audio" /C:"torch.availability"
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





