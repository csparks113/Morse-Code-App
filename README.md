# Morse Code Master

A premium dark-themed Expo + React Native app for learning, practicing, and mastering Morse code.

## Features
- Koch-style lessons that cover the alphabet and numerals.
- Practice sending and receiving Morse with Nitro-backed low-latency outputs.
- Real-time latency telemetry (tone, flash, haptic, torch) surfaced in developer mode.
- Adjustable WPM, tone frequency, and per-channel toggles.
- Progress tracking with Zustand + AsyncStorage persistence.
- Native screen flash overlay with configurable tint/brightness (25%–100%) across receive, send, practice, and settings previews.
- Expo Router navigation and lesson challenges.

## Architecture Overview
- Expo + React Native + TypeScript running in the bridgeless New Architecture (Hermes) runtime.
- Nitro `OutputsAudio` (Android) built from source with Oboe provides the default audio path and now shares native symbol timestamps with JS so replay/console scheduling follows the audio clock; Audio API fallback stays behind env toggles for diagnostics.
- Expo modules remain as fallbacks for flash, torch, and haptics; Android prefers the Nitro dispatcher for all outputs with Expo as the safety net.
- Developer console exposes manual triggers, telemetry summaries, and exports for latency analysis.

## Getting Started
```bash
npm install
EXPO_USE_NEW_ARCHITECTURE=1 npx expo start --dev-client
```

- Keep Metro running with `npx expo start --dev-client` so bridgeless builds can attach.
- Android: use the VS Developer Command Prompt, then run `EXPO_USE_NEW_ARCHITECTURE=1 npx expo run:android --device --variant debug` (or omit `--variant` for emulator). Ensure `adb reverse tcp:8081 tcp:8081` is active.
- iOS (macOS required): follow the checklist in `docs/android-dev-client-testing.md` to run `EXPO_USE_NEW_ARCHITECTURE=1 npx expo run:ios --device` or build via Xcode.

## Tooling Requirements
- Node 18+, npm 9+.
- Android Studio command-line tools, SDK 36, and NDK 27.1.12297006; Visual Studio 2022 Build Tools with Desktop C++ workload for Hermes.
- Python 3.x on PATH for Hermes build scripts.
- Expo CLI (`npx expo`).
- For iOS: Xcode 16.x and CocoaPods.

## Development Tips
- Clear Metro cache: `EXPO_USE_NEW_ARCHITECTURE=1 npx expo start --dev-client -c`.
- Lint: `npm run lint`.
- Format: `npm run format`.
- Type-check: `npx tsc --noEmit`.
- Logcat filters:
  - Nitro audio: `adb logcat ReactNativeJS:D ReactNative:W *:S | findstr /C:"[outputs-audio]"`.
  - Latency traces: `adb logcat ReactNativeJS:D ReactNative:W *:S | findstr /R /C:"keyer.prepare" /C:"keyer.tone"`.

## Documentation
- Living spec: `docs/living-spec.md`.
- Android dev client log: `docs/android-dev-client-testing.md`.
- Nitro prep checklist: `docs/nitro-integration-prep.md`.
- Developer console updates: `docs/developer-console-updates.md`.
- Outputs diagnostics: `docs/outputs-investigation.md`.

## Folder Structure (excerpt)
```text
app/
  (tabs)/
    index.tsx        # Lessons hub
    practice.tsx     # Practice playground
    settings.tsx     # Channel toggles, developer mode
  lessons/
    [group]/
      overview.tsx
      [lessonId]/
        receive.tsx
        send.tsx
components/
  LessonPath.tsx
  SessionHeader.tsx
  NeonHeaderCard.tsx
outputs-native/
  android/
    c++/OutputsAudio.cpp   # Nitro OutputsAudio implementation
  audio.nitro.ts           # JS spec for Nitro OutputsAudio
store/
  useSettingsStore.ts
  useProgressStore.ts
utils/
  audio.ts
  morse.ts
```

- Capture fresh torch alignment logs (Play Pattern + receive replay) and mirror the work on iOS once hardware is available.
- Promote the flash tint configuration into shared theme tokens so both native and JS overlays pull from a single source.
- Finish the incremental Nitro alignment plan so tone/flash/haptic/torch stay within ~5 ms across Play Pattern sweeps.
- Harden send keyer classification at higher WPM with adaptive thresholds and regression guards.
- Restructure the lessons tab into sections/subsections with updated progress tracking.
- Expand practice modes (Timing/Target/Custom) once the outputs orchestrator and telemetry guardrails are in place.
- Deliver full multi-language support with localized content, per-language keyboards, and QA coverage.
- Validate Nitro parity on iOS using the bridgeless dev client checklist.

- Developer console **Play Pattern** still shows ~30-40 ms average drift between audio and flash/haptics; native scheduling work is ongoing to reach parity.
- Receive replays can spike by ~160 ms when Nitro falls back to timeline offsets; dispatch tuning is in progress.
- Send keyer misclassifies dot-leading sequences at higher WPM; classification thresholds are under review.
- Send session verdicts can race the classifier on long holds, producing inconsistent scoring.

## Troubleshooting
- If the dev client hangs on splash, ensure Metro is running and `adb reverse tcp:8081 tcp:8081` is active.
- If Nitro modules are missing, rebuild from the VS Developer Command Prompt so Hermes/Nitro libraries compile with the correct toolchain.
- For `Unable to load script`, restart Metro with `--dev-client -c` and reinstall the dev client.
