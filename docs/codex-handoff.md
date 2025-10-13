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
- **Summary:** Adaptive flash scheduler now pre-arms RAF from prior `scheduleSkewMs`, applies a capped `audioStartLeadMs` (<=96 ms) with a minimum-headroom guard, and replays schedule from `nativeExpectedTimestampMs`; remaining analyzer spikes stem from stale `audioStartCompensationMs` surviving timeline fallbacks, not real latency. Docs (`refactor-notes`, `outputs-investigation`, `outputs-alignment-notes`) track the 13:56?16:20 sweep trend.
- **State:** Need fresh device sweeps to confirm the adaptive lead collapses the flash `scheduleSkewMs` tail and to decide whether further tone-lead trims or scheduleMonotonic migration are still required.

## Next Steps
1. Before launch, cap settings at 30 WPM and verify audio->flash/haptic skew stays under 15 ms through Play Pattern + SOS sweeps.
2. Purge `audioStartCompensationMs`/timeline offsets when the guard falls back to timeline and rerun Play Pattern to confirm analyzer means drop toward <15 ms.
3. Capture new Play Pattern + SOS runs with the adaptive `preScheduleLeadMs`/`audioStartLeadMs` path and dump scheduleSkew/audio->flash stats back into `docs/outputs-investigation.md`.
4. If spikes stay above ~60 ms, prototype replay/receive dispatch on `scheduleMonotonic` (or reduce the native tone lead below 20 ms) and compare against the adaptive JS lead.
5. Continue weekly SOS->40 WPM sweeps, logging any >1 s flash commits and archiving the matching logcat snippets in `docs/logs/`.
## Verification
- `npm run lint` *(fails)* — command timed out after ESLint attempted to parse generated bundle artifacts (`..bundle.js`, `..virtual-entry.bundle.js`), which already trigger thousands of legacy lint errors.

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




