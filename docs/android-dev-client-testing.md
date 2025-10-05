# Android Dev Client Investigation Log

> **Maintainers:** Add each new debugging session to the end of this file. Start with the date, note the build commands you ran, key log findings, and the outcome. If you change the recommended next steps, update the final section accordingly instead of duplicating guidance. Keep entries concise so future sessions can scan the history quickly.

## Session Summary

- Windows build tooling is now standardized (Visual Studio Dev Prompt, NDK 27.1, CMake); Gradle builds ReactAndroid/Hermes from source via the composite include without manual patches.
- The app now uses React Native's upstream CMake template so `libappmodules.so` is produced; Nitro still ships as `libmorseNitro.so`, and both libraries are packaged for every ABI.
- Nitro's generated loader initializes `libmorseNitro.so` before the bridgeless host spins up, and SoLoader (initialized with `OpenSourceMergedSoMapping`) resolves the merged symbols cleanly.
- With Metro running (`npx expo start --dev-client` plus `adb reverse tcp:8081 tcp:8081`), the Expo Android dev client boots to the JS runtime; the only remaining warning is that the `OutputsAudio` HybridObject is not yet default-constructible.

## Current Diagnosis

- Bridgeless startup succeeds: `libappmodules.so` and the merged ReactAndroid symbols load, TurboModules resolve, and the client no longer stalls on the splash screen.
- The Nitro warning about `OutputsAudio` not having a default constructor is the only outstanding issue; it does not block startup but should be cleaned up for correctness.

## Recommended Next Steps

1. Smoke-test the dev client (navigation, reloads, Expo Router flows) with Metro attached to confirm bridgeless stability.
2. Update the Nitro `OutputsAudio` HybridObject (for example, add the `HybridObject(TAG)` base constructor) so the module initializes without warnings.
3. Validate the Nitro audio path and latency, watching for any fallback to the Audio API.
4. Monitor logcat for recurring `libappmodules.so` recovery warnings—none are expected now, but note any regressions.
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

### Current Blocker

- Bridgeless startup continues to crash because `SoLoader.loadLibrary("react_featureflagsjni")` fails even when `libreactnative.so` is present. The app returns to the splash screen immediately after logging the `SoLoaderDSONotFoundError`.

### Next Actions

1. Investigate SoLoader's merged library mapping (`OpenSourceMergedSoMapping`) to ensure `react_featureflagsjni` and `react_newarchdefaults` resolve to `libreactnative` before ReactNativeFeatureFlags initializes.
2. If SoLoader cannot map the merged symbols, derive standalone shared libraries from the ReactAndroid sources without breaking the existing `libreactnative` link (e.g., share object libraries or add thin wrapper targets).
3. Once `SoLoader` can load the feature flag libraries, rebuild (`gradlew.bat app:assembleDebug`) and reinstall the dev client to validate bridgeless startup and the Nitro audio path end-to-end.

### Pending After Toolchain Install

- Prefab duplicate is resolved—`com.facebook.react:react-native` now resolves to the composite source build, so only the locally built prefab should be consumed.
- Hermes/DIA environment is healthy when Gradle is invoked from the Visual Studio developer prompt.
- Dev client remains blocked on `SoLoaderDSONotFoundError` until we provide loadable `react_featureflagsjni` / `react_newarchdefaults` shared libraries.
## Follow-up Session (2025-10-05 Late Night)

- Updated `MainApplication` to initialize SoLoader with `OpenSourceMergedSoMapping` and removed the direct `DefaultNewArchitectureEntryPoint.load()` call so we do not double-override feature flags. Missing libs now map into `libreactnative.so`.
- Rebuilt via `gradlew app:assembleDebug --stacktrace --console=plain --no-daemon` inside the VS dev prompt and reinstalled the debug APK.
- Launch logcat shows `New Architecture native libraries loaded successfully.` and no `SoLoaderDSONotFoundError` for `libreact_featureflagsjni.so`; only the expected `libappmodules.so` warnings remain.
- App still needs manual verification beyond the splash screen, but the native loader now succeeds with the merged ReactAndroid build.
## Follow-up Session (2025-10-05 Late Night, continued)

- Swapped the app CMake script for the upstream React Native template, added Nitro include paths, and moved the Nitro JNI adapter under `android/app/src/main/cpp/nitro/` so it only links with `libmorseNitro.so`.
- Added `appmodules` to the Gradle `externalNativeBuild` target list; `gradlew app:assembleDebug --stacktrace --console=plain --no-daemon` now produces and packages `libappmodules.so` alongside the Nitro libraries.
- Rebuilt, reinstalled the dev client, and confirmed logcat shows `libappmodules.so` loading cleanly and Nitro HybridObjects registering exactly once (`latest-logcat.txt:1058`, `latest-logcat.txt:937-1340`).
- Metro must be running (`npx expo start --dev-client`, plus `adb reverse tcp:8081 tcp:8081`) or the dev client will still report `Unable to load script` while waiting for the JS bundle.







