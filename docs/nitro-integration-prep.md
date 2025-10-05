# Nitro Integration Prep

## Current Flags
- `app.json` / `app.config.ts` keep `newArchEnabled: true`; bridgeless builds are required for Nitro modules.
- Always run Expo tooling with `EXPO_USE_NEW_ARCHITECTURE=1` so prebuild/EAS stay on the bridgeless path.
- Nitro audio is the default output path; the Audio API fallback stays available via `EXPO_DISABLE_NITRO_OUTPUTS` for diagnostics only.

## Dependencies & Versions
- `react-native-nitro-modules@0.29.x`, `react-native-nitro-haptics@0.1.0`, and `nitrogen` pinned in devDependencies.
- Android Oboe is bundled via the Nitro module; no extra NDK dependencies beyond 27.1.12297006.
- Keep `react-native-worklets` aligned with Nitro/audio integrations when the Audio API fallback is exercised.

## Native Build Settings
- Windows: keep the workspace near the drive root (for example `C:\dev\Morse`) or enable long paths to avoid CMake/Ninja issues.
- Android: minSdk 23, compileSdk 35, targetSdk 35, NDK 27.1.12297006. Gradle packages both `libappmodules.so` and `libmorseNitro.so` per ABI.
- iOS: leave `RCT_NEW_ARCH_ENABLED=1`; Pods should integrate Nitrogen-generated projects without manual Xcode edits.

## Android Implementation (2025-10-05)
- Dedicated `morseNitro` CMake target (under `android/app/src/main/cpp`) wraps the Nitrogen-generated `OutputsAudio` hybrid and links Oboe.
- `outputs-native/android/c++` hosts the implementation with explicit `margelo::nitro::HybridObject(TAG)` registration so the bridgeless host loads cleanly.
- `MainApplication` calls `System.loadLibrary("morseNitro")` during `onCreate` so Nitro registers before the React host spins up.
- JS `shouldPreferNitroOutputs()` controls warm-up via `configureAudio`; Nitro playback drives tone/haptic/torch logging while the Audio API fallback remains behind env toggles.

## iOS Setup Quickstart
1. Install Xcode 16.x, select it via `sudo xcode-select --switch /Applications/Xcode.app`, and ensure CocoaPods is installed.
2. From the repo root run `npm install` then `npm run nitro:codegen` to refresh Nitrogen outputs.
3. Execute `EXPO_USE_NEW_ARCHITECTURE=1 npx expo prebuild --platform ios --clean` (omit `--clean` for incremental syncs).
4. Inside `ios/`, run `bundle exec pod install` (or `pod install`) and return to the project root.
5. Start Metro (`npx expo start --dev-client`), then launch the dev client with `EXPO_USE_NEW_ARCHITECTURE=1 npx expo run:ios --device` or via Xcode.
6. Verify Nitro registration (`OutputsAudio` in the Xcode console) and capture keyer timing logs to compare against Android.

## Codegen Workflow
1. Run `npx nitrogen init` when packages are installed to scaffold `nitrogen.json`.
2. Define codegen targets for `outputs-native/audio` and related modules.
3. Commit generated `cpp/`, `ios/`, and `android/` bindings so CI builds without rerunning codegen.
4. Add `"nitro:codegen": "npx nitrogen apply"` to `package.json` and hook it into `preprebuild`.
5. For EAS, add a `cli.postInstall` hook (or `eas-build-pre-install`) that runs `npm run nitro:codegen` before native compilation.

## Expo Config Notes
- `withNitroCodegen.ts` keeps `newArchEnabled` asserted and runs Nitrogen codegen during prebuild.
- Audio API overrides stay checked in but default to Nitro-first: override background audio/permissions only when shipping the fallback.

## Validation Checklist
1. `expo prebuild --clean` succeeds locally with Nitro dependencies installed and codegen hooks enabled.
2. `gradlew :app:assembleDebug` builds without toggling `newArchEnabled` in Gradle properties.
3. `pod install` completes and Nitrogen pods appear in the Xcode workspace.
4. Dev clients boot with Nitro audio/haptics enabled; monitor `[outputs-audio]` + `keyer.*` logs for latency or fallback warnings.
5. `npm run nitro:codegen` is idempotent on a clean tree.

## Known Issues (2025-10-05)
- Developer console **Play Pattern** introduces audible delay and flash/haptic/torch drift; profile the Nitro replay scheduler before shipping replay flows.
- Send keyer misclassifies dot-leading sequences (for example `...-`) at higher WPM; tighten timing heuristics and continue logging `keyer.classification` events.
- Track Nitro vs Audio API touch-to-tone deltas in `docs/android-dev-client-testing.md` whenever tuning changes land.
