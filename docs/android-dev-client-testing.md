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

1. Use the updated log capture script to collect fresh Play Pattern runs; archive them under `docs/logs/` and record audio vs flash/haptic deltas here so we can track the impact of the new native timestamp data.
2. Implement the incremental Nitro alignment plan:
   - Land the native keyer input module so rapid dots use native timestamps (eliminates the "continuous tone" issue).
   - Propagate Nitro symbol timestamps through JS consumers and adjust flash/torch scheduling to target the native start time.
   - If drift persists, add native-driven flash/torch triggers as the next increment.
3. After each increment, rerun the capture/analysis and update this log with before/after metrics (include the archived file path and summary table).
4. Once Android alignment holds, repeat the captures on iOS using the checklist below and document any platform deltas.
5. Keep monitoring `adb`/Metro for warnings after dependency bumps (for example default-constructor failures or `Unable to load script`).

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



## Follow-up Session (2025-10-05 – Output Timing Audit)

- Commands: `adb logcat ReactNativeJS:D OutputsAudio:D ReactNative:W *:S` (120 s capture) while running **Play Pattern** to trigger flash/haptic/audio timelines.
- Archived log: `docs/logs/logcat-play-pattern-20251005-221619-post-timestamp-prototype.txt`.
- Nitro audio leads the React flashes/haptics by roughly 0.1 s; flashes occasionally trail by >250 ms while audio stays on time.
- Keyer prepare spans remain ~50–60 ms during console playback; tone durations hold near 125 ms with occasional longer presses.

**Timing Metrics** (derived via `docs/outputs-log-monitoring.md` helpers)
- `audio_start ? haptic`: count 101 · min 1 ms · max 625 ms · mean 96.39 ms · p95 251 ms
- `audio_start ? flash`: count 101 · min 1 ms · max 630 ms · mean 97.36 ms · p95 257 ms
- `haptic ? flash`: count 245 · min 0.62 ms · max 748.24 ms · mean 15.80 ms · p95 146.97 ms
- `flash ? commit`: count 245 · min 11.61 ms · max 316.57 ms · mean 67.30 ms · p95 86.08 ms
- `keyer.prepare duration`: count 41 · min 39.78 ms · max 83.45 ms · mean 48.49 ms · p95 59.17 ms
- `keyer tone duration`: count 28 · min 89.96 ms · max 190.27 ms · mean 125.35 ms · p95 161.18 ms

**Follow-ups**
- Prototype emitting Nitro's native start timestamp alongside `outputs.playMorse.symbol` so the React layer can align flash/haptic cues with the audio baseline.
- Re-run the Play Pattern capture after the prototype to verify audio/flash deltas shrink and update this log with the new metrics.


## Follow-up Session (2025-10-05 Wrap-up)

- Attempted to launch a 180 s Play Pattern capture via the PowerShell job script inside Codex CLI; the harness timed out after 10 s so no new log was recorded.
- Updated docs/outputs-log-monitoring.md so the logcat recipe keeps OutputsAudio:D lines alongside the JS events.
- Recommended to re-run the capture from a local shell (outside the CLI timeout) once the native timestamp plumbing lands, then archive the log under docs/logs/ for diffing.
- Re-ran Play Pattern capture on 2025-10-06 21:13 and archived the log at `docs/logs/logcat-play-pattern-20251006-2113-native-symbols.txt` using the updated PowerShell capture script.
- Native timestamp propagation works end-to-end: JS `playMorse.symbol` events now carry `nativeTimestampMs`/`nativeOffsetMs`, and the latest run shows mean JS delay versus native tone start ranging from ~40 ms (`unitMs` 24) up to ~150 ms (`unitMs` 120) with P95 roughly 86-323 ms (native offsets match those numbers).
- 2025-10-06 21:36 capture after native-aligned playback loop: archived at `docs/logs/logcat-play-pattern-20251006-2136-native-sync.txt`. Overall JS delay vs native audio now averages ~33 ms with P95 ˜88 ms across 540 symbols; per-unit runs range from ~15-49 ms mean and 28-123 ms P95 (unitMs 24–120).
- Outstanding integration tasks: finish the OutputsAudio.cpp reset handling, tighten pollNextNativeSymbol guards in utils/audio.ts, and confirm the NativeSymbolTimingContext import stays DCE-safe for web/iOS builds.

