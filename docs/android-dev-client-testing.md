# Android Dev Client Investigation Log

> **Maintainers:** Add each new debugging session to the end of this file. Start with the date, note the build commands you ran, key log findings, and the outcome. If you change the recommended next steps, update the final section accordingly instead of duplicating guidance. Keep entries concise so future sessions can scan the history quickly.

## Session Summary

- Bridgeless dev client on the New Architecture builds reliably from the VS Developer Command Prompt with NDK 27.1; Gradle now packages both `libappmodules.so` and `libmorseNitro.so` for every ABI.
- Nitro `OutputsAudio` lives under `outputs-native/android/c++` with explicit `HybridObject` registration, keeping Nitro as the default low-latency audio path while the Audio API fallback stays available behind the env toggles.
- Bridgeless dev client boots whenever Metro is running (`npx expo start --dev-client` plus `adb reverse tcp:8081 tcp:8081`); keyer logs confirm Nitro audio, haptics, and torch flows stay entirely on the native thread.
- Investigation history below is preserved for context; new iOS setup notes capture the steps required to bring up the bridgeless dev client on macOS.

## Current Diagnosis

- Bridgeless startup is stable on the latest dev client builds; Nitro audio, haptics, and torch integrations run end-to-end with the latencies logged above.
- No native library blockers remain; focus shifts to console replay alignment, keyer classification accuracy, and cross-platform parity.

## Known Issues

- Developer console **Play Pattern** drift: tone, flash, haptic, and torch cues fall out of sync at higher WPM; profile the Nitro replay scheduler before shipping the console replay flow.
- Send keyer misclassifies dot-leading sequences (for example `...-`) at higher WPM; tighten the timing heuristics and add instrumentation to confirm fixes.

## Recommended Next Steps

1. Keep Metro running interactively during testing; capture `[outputs-audio]` and `keyer.*` latency snapshots and refresh `latest-logcat.txt` whenever behaviour changes.
2. Profile the developer console **Play Pattern** drift and record backlog notes here until the Nitro replay pipeline keeps all channels aligned.
3. Tighten the send keyer dot/dash heuristics at higher WPM; document threshold updates and correlate with `keyer.classification` traces.
4. Follow the iOS setup checklist below to bring up the bridgeless dev client on macOS and confirm Nitro parity.
5. Monitor logcat and Metro for new warnings after dependency bumps or codegen runs (for example default-constructor failures or `Unable to load script`).

## iOS Setup Checklist


1. Use macOS with Xcode 16.x installed (`sudo xcode-select --switch /Applications/Xcode.app`) and ensure CocoaPods is available (`sudo gem install cocoapods` if needed).
2. From the repo root install dependencies and regenerate Nitrogen bindings: `npm install` then `npm run nitro:codegen`.
3. Sync native sources with Expo prebuild while New Architecture is enabled: `EXPO_USE_NEW_ARCHITECTURE=1 npx expo prebuild --platform ios --clean` (omit `--clean` when you only need configuration updates).
4. Install pods inside `ios/`: `cd ios && bundle exec pod install` (or `pod install`) and return to the project root.
5. Start Metro via `npx expo start --dev-client`, then launch the dev client with `EXPO_USE_NEW_ARCHITECTURE=1 npx expo run:ios --device` or open `ios/MorseCodeApp.xcworkspace` in Xcode and run it on a device/simulator.
6. Verify the Nitro module registers (look for "OutputsAudio" in the Xcode console) and capture keyer timing logs; keep the device on the same network as Metro.

## Follow-up Session (2025-10-04)

- Switched from Maven artifacts to a local composite build (`includeBuild('../node_modules/react-native')`) so Gradle can compile `ReactAndroid` and `hermes-engine` from source.
- Added dependency substitutions for `com.facebook.react:react-android`/`hermes-android`, created matching version catalogs, and pointed both the app and included build at the local SDK via `local.properties`.
- Installed the Android command-line tools and CMake 3.30.5 with `sdkmanager.bat` (these are required by the Hermes build scripts).
- Verified Visual Studio 2022 Build Tools (Desktop development with C++) are present; launching `VsDevCmd.bat` exposes `nmake.exe` under `VC\Tools\MSVC\14.50.35503\bin`.
- Confirmed Python 3.13.7 is installed at `C:/Users/cspar/AppData/Local/Programs/Python/Python313/python.exe`; prepended the Python install + `Scripts` directories to `PATH` and exported `PYTHON_EXECUTABLE` before invoking Gradle.
- Added a patch (`patches/react-native+0.81.4.patch`) that normalizes Hermes on Windows: it injects the MSVC `Hostx64\x64` bin directory into PATH, forces `CMAKE_MAKE_PROGRAM`, and normalizes `JSI_DIR` to forward slashes. `package.json` now runs `patch-package` during `postinstall` so the tweak re-applies after installs.
- Attempted to remove the prefetched Maven prefab (`~/.gradle/caches/**/transformed/react-android-0.81.4-debug`) before `configureCMake`. Removing the directory in-place caused downstream builds to fail (missing `libreactnative.so`) because third-party modules still resolve to the transformed Maven prefab. Restored the original build script afterwards so we remain on the same blocker as before.
- Latest build (`gradlew app:assembleDebug --stacktrace --console=plain --no-daemon`) still fails at `:app:configureCMakeDebug[arm64-v8a]` with `[CXX1429] Multiple packages named ReactAndroid found` once both the cached Maven prefab and the composite output are present (`android/build.log:948-1184`).

## Follow-up Session (2025-10-04 Evening)

- Added an additional substitution in `android/settings.gradle` so `com.facebook.react:react-native` now resolves to the composite `:packages:react-native:ReactAndroid` project, ensuring transitive dependencies (e.g., `react-native-webview`) no longer pull the Maven prefab.
- Verified the dependency graph with `./gradlew.bat app:dependencies --configuration debugRuntimeClasspath --no-daemon --console=plain`; `react-native-webview` now points at the composite project instead of `com.facebook.react:react-android` (`android/app/build.gradle` indirectly resolves correctly).
- Reran `./gradlew.bat app:assembleDebug --stacktrace --console=plain --no-daemon` and the build progressed past Prefab, but now fails earlier at `:react-native:packages:react-native:ReactAndroid:hermes-engine:configureBuildForHermes` because CMake cannot locate the DIA SDK (`android/build.log:535-568`).

## Follow-up Session (2025-10-05)

- Invoked the Visual Studio Developer Command Prompt (`VsDevCmd.bat` from `C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools`) before running Gradle so the DIA SDK environment variables (`VCINSTALLDIR`, `DIA_SDK_DIR`) are populated. Subsequent `app:assembleDebug` runs now reach Hermes without DIA errors.
- Applied the Nitrogen autolinking Gradle fragment in `android/app/build.gradle` and wired `externalNativeBuild` to `src/main/cpp/CMakeLists.txt`, enabling the `morseNitro` target alongside the React Android composite build.
- Enabled Prefab in the app module and added the `com.google.oboe:oboe:1.9.3` dependency so CMake can resolve the Oboe prefab during the Nitro build.
- Rebuilt via `powershell.exe -NoProfile -Command "& cmd /c 'call VsDevCmd && cd android && gradlew.bat app:assembleDebug --stacktrace --console=plain --no-daemon'"`; the build succeeded (`android/build_vsdev.log`) and the resulting `app-debug.apk` now includes `libmorseNitro.so` for all ABIs in addition to the New Architecture libraries.
- Removed the runtime guard that disabled New Architecture, preloaded `libreactnative.so` before ReactHost spin-up, and captured new logcat traces. Despite these changes the bridgeless runtime still aborts, logging repeated `SoLoaderDSONotFoundError: couldn't find DSO to load: libreact_featureflagsjni.so` (`latest-logcat.txt`).
- Experimented with exporting standalone `libreact_featureflagsjni.so`/`libreact_newarchdefaults.so` from the ReactAndroid CMake build. Converting the object targets into shared libraries triggered cascading link failures (missing Hermes/fbjni symbols, unresolved ReactNative references), so the changes were rolled back.

### Historical Blocker (Resolved)

- (2025-10-05) Resolved the earlier `SoLoader.loadLibrary("react_featureflagsjni")` failure by initializing SoLoader with `OpenSourceMergedSoMapping` and adopting the upstream React Native CMake template. The historical notes that follow are retained for context only.

### Toolchain Notes

- Prefab duplication is resolved: `com.facebook.react:react-native` now resolves to the composite source build, so only the locally built prefab is consumed.
- Hermes/DIA environment stays healthy when Gradle runs inside the Visual Studio Developer Prompt.
- Always start Metro (and `adb reverse tcp:8081 tcp:8081` on Android) before launching the dev client to avoid `Unable to load script` during bridgeless startup.

## Follow-up Session (2025-10-05 Late Night)

- Updated `MainApplication` to initialize SoLoader with `OpenSourceMergedSoMapping` and removed the direct `DefaultNewArchitectureEntryPoint.load()` call so we do not double-override feature flags. Missing libs now map into `libreactnative.so`.
- Rebuilt via `gradlew app:assembleDebug --stacktrace --console=plain --no-daemon` inside the VS dev prompt and reinstalled the debug APK.
- Launch logcat shows `New Architecture native libraries loaded successfully.` and no `SoLoaderDSONotFoundError` for `libreact_featureflagsjni.so`; only the expected `libappmodules.so` warnings remain.
- App still needs manual verification beyond the splash screen, but the native loader now succeeds with the merged ReactAndroid build.
## Follow-up Session (2025-10-05 Late Night, continued)

- Swapped the app CMake script for the upstream React Native template, added Nitro include paths, and moved the Nitro JNI adapter under `android/app/src/main/cpp/nitro/` so it only links with `libmorseNitro.so`.
- Added `appmodules` to the Gradle `externalNativeBuild` target list; `gradlew app:assembleDebug --stacktrace --console=plain --no-daemon` now produces and packages `libappmodules.so` alongside the Nitro libraries.
- Rebuilt, reinstalled the dev client, and confirmed logcat shows `libappmodules.so` loading cleanly and Nitro HybridObjects registering exactly once (`latest-logcat.txt:1058`, `latest-logcat.txt:937-1340`).
- Metro must be running (`npx expo start --dev-client`, plus `adb reverse tcp:8081 tcp:8081`) or the dev client will still report `Unable to load script` while waiting for the JS bundle.`r`n`r`n## Follow-up Session (2025-10-05 Evening)

- Added `margelo::nitro::HybridObject(HybridOutputsAudioSpec::TAG)` to the OutputsAudio constructor under `outputs-native/android/c++`, rebuilt via `gradlew.bat :app:externalNativeBuildDebug`, and reinstalled the dev client.
- Confirmed Nitro HybridObjects register cleanly: Metro and logcat show keyer prepare/press/replay events with Nitro latencies and no default-construction warnings.
- Documented the Metro plus `adb reverse` workflow so future runs avoid `Unable to load script` during bridgeless startup.
- Captured Nitro latency snapshots (manual keying, console replay, session send/receive) for ongoing performance comparisons.



