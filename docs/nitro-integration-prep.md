# Nitro Integration Prep

## Current Flags
- `app.json` already sets `newArchEnabled: true`; keep it pinned when we switch to `app.config.ts` so Expo prebuild does not drop the flag.
- Ensure `expo` CLI invocations (`expo prebuild`, `expo run:[platform]`, EAS Build) always execute with `EXPO_USE_NEW_ARCHITECTURE=1` to avoid silent fallbacks.

## Dependencies & Versions
- Target `react-native-nitro-modules@0.29.x` (confirmed compatible with React Native 0.81) and `react-native-nitro-haptics@0.1.0`.
- Add `nitrogen` as a devDependency so codegen is versioned alongside the modules.
- Keep `react-native-worklets` in sync with the version required by `react-native-audio-api`; lift to `^0.6.0` once the audio package is installed.

## Native Build Settings
- Windows: keep the workspace close to the drive root (for example `C:\\dev\\Morse`) so CMake/Ninja stay under MAX_PATH; enable long paths if the project must live deeper than ~100 characters.`r`n
- Android: minSdk 23, compileSdk 35, targetSdk 35, NDK 27.1.12297006 (Nitro's baseline). Update `eas.json` build profiles and Gradle extensions once both Nitro and Audio overrides are in place.
- iOS: enable modules in New Architecture by leaving `RCT_NEW_ARCH_ENABLED=1` (Expo sets this when `newArchEnabled` is true). Confirm Pods integrate Nitrogen-generated projects without manual Xcode changes.

## Codegen Workflow
1. Run `npx nitrogen init` after installing the packages to scaffold `nitrogen.json`.
2. Define codegen targets for:
   - `packages/outputs-native/audio` (Audio orchestrator bindings once AudioAPI lands).
   - `packages/outputs-native/haptics` (Nitro haptics boxing helpers).
3. Commit the generated `cpp/` and `ios/`/`android/` bindings so CI can build without re-running codegen.
4. Add `"nitro:codegen": "npx nitrogen apply"` to `package.json` and wire it into the `prebuild` workflow (`"preprebuild": "npm run nitro:codegen"`).
5. For EAS, add a `cli.postInstall` hook (or `eas-build-pre-install` script) that runs `npm run nitro:codegen` to regenerate bindings before Gradle/Xcode compile.

## Expo Config Plugin Plan
- Create `plugins/withNitroCodegen.ts` that:
  - Asserts `newArchEnabled` is true on both platforms.
  - Registers a `withDangerousMod` to invoke `npm run nitro:codegen` during `expo prebuild` (only when native folders exist).
  - Adds `nitro`'s generated Android module directory to `settings.gradle` if the CLI does not already do it.
- Chain the plugin in `app.config.ts` after the audio overrides so both modifications happen in one pass.

## Audio API Plugin Overrides
- Current defaults (2025-10-03) disable iOS background audio (`iosBackgroundMode=false`), strip all Android permissions, and turn off the Audio API foreground service. This keeps the app from requesting media/background entitlements while we validate the new tone path.
- When we are ready to support background playback, flip these flags in `app.config.ts` (enable `iosBackgroundMode`, add the localized microphone/media permissions, and set `androidForegroundService` along with the required notification channel).
- After changing any overrides, run `npx expo config --type prebuild` to confirm the generated `app.json` matches expectations before running `expo prebuild`/EAS.
- Document the final settings in release notes so QA knows which permissions to validate on device.


## Validation Checklist
1. `expo prebuild --clean` succeeds locally with Nitro dependencies installed and codegen hook enabled.
2. `gradlew :app:assembleDebug` runs without manually toggling `newArchEnabled` in Gradle properties.
3. iOS `pod install` completes and the generated Nitrogen pods appear in the workspace.
4. Dev client boots with Nitro haptics mocked out (until native work lands) while `react-native-nitro-modules` is present.
5. `npm run nitro:codegen` is idempotent and produces no diff on clean tree.

## Open Questions
- Confirm whether Nitro's targetSdk 35 requirement conflicts with AudioAPI's temporary 34 override; decide if we raise `AudioAPI_targetSdkVersion` once Nitro is installed.
- Verify if Expo's metro config needs extra `resolver.extraNodeModules` entries for Nitrogen outputs.
- Document how we box Nitro modules for Reanimated worklets (likely a helper under `services/outputs/nitroBoxing.ts`).



