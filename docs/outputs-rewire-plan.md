# Outputs Rewire Plan

## Selected Stack
- **Audio**: react-native-audio-api (JSI/TurboModule) targeting <=10 ms touch-to-tone latency with prewarmed oscillators.
- **Haptics**: react-native-nitro-haptics (TurboModule) as primary path; expo-haptics as safety fallback.
- **Screen Flash**: Reanimated 3 UI-thread animations powering the FlashOverlay layer.
- **Torch**: expo-torch (or expo-camera torch helper) with permission gating and warm start.

## Integration Phases
1. **Foundations & Benchmarks**
   - **Compatibility audit**
     - Confirm `react-native-audio-api` (>=0.3.x) and `react-native-nitro-haptics` expose TurboModule/JSI entry points compatible with React Native 0.81 / Expo SDK 54 builds.
     - Validate the packages ship podspecs/Gradle configs that do not conflict with Expo prebuild (no manual `Podfile` edits, supports hermes/metro).
     - Review native dependency requirements (AudioKit/AAE on iOS, Oboe on Android) and note any minimum OS versions or NDK constraints in the backlog.
     - **Current findings**
       - `react-native-audio-api@0.8.2` hard-blocks React Native <0.76 via its Gradle guard; Expo SDK 51 (RN 0.73) cannot build until we upgrade Expo (>=53) or negotiate a patch upstream. Module ships an Expo config plugin that adds iOS background audio modes plus Android foreground-service + media playback permissions.
       - iOS bundles FFmpeg-based xcframeworks (~30 MB) and links CoreAudio/Accelerate; confirm our EAS binary size budget and ensure `ENABLE_BITCODE=NO` stays set. Android pulls in `com.google.oboe:oboe:1.9.3`, requires NDK r25+, and enables CMake with 16KB aligned packaging.
       - `react-native-nitro-haptics@0.1.0` depends on `react-native-nitro-modules@0.29.8`; both assume New Architecture + Nitro toolchain. Expo prebuild must enable `newArchEnabled`, add the Nitro package, and satisfy Kotlin/Swift toolchain requirements. No Expo plugin is provided, so we will author a lightweight config plugin to register Nitro's Gradle/PBX tweaks if Expo demands it.
   - **Install prep**
     - Add both packages plus supporting dev types to `package.json`; update `expo` plugin config if either module provides an Expo config plugin.
     - Run a local `expo prebuild` smoke to ensure autolinking succeeds and capture any manual pod/Gradle steps we must script in EAS.
     - Prepare EAS build profiles with `EX_DEV_CLIENT` toggles so we can test the audio stack inside dev client without reinstall friction.
   - **Baseline instrumentation**
     - Add high-resolution timers on the keyer press path (gesture-handler `onBegin`/`onFinalize`) and current OutputsService sinks to measure input-to-output deltas per channel.
     - Emit structured telemetry (`latency.touchToTone`, `latency.touchToHaptic`, etc.) with p50/p95/jitter aggregates into the developer console and log to disk for later regression comparison.
     - Capture device/build metadata (model, OS, JS engine, release vs dev client) alongside each sample to map variability.
   - **Orchestrator contract**
     - Draft the `OutputsOrchestrator` interface (`prepareChannels`, `engage`, `release`, `cancel`, `setTimelineOffset`) and document required timeline guarantees.
     - Define telemetry callbacks/events (success/failure, latency samples, warm-up complete) that the orchestrator must emit for downstream tooling.
2. **Audio + Haptics**
   - Install react-native-audio-api and react-native-nitro-haptics (ensure JSI build steps in EAS).
   - Prewarm the tone generators (steady oscillator + gated envelope) and expose a warm-up hook to avoid first-call lag.
   - Map orchestrator calls to native fire-and-forget triggers; capture success/failure events for tracing.
3. **Visual Channels**
   - Rebuild FlashOverlay with Reanimated UI worklets so animations run off the JS thread.
   - Add torch controller via expo-torch with permission checks, warm initialization, and throttling guards.
4. **Orchestration Layer**
   - Introduce an OutputsOrchestrator service that generates unified channel timelines and proxies to the native modules.
   - Rewire send/receive hooks (useSendSession, useReceiveSession, useKeyerOutputs) plus toggles to call the orchestrator.
   - Preserve developer tracing by emitting outputs.* events from the orchestrator.
5. **Keyer Precision**
   - Replace keyer button logic with react-native-gesture-handler press tracking + high-resolution timing.
   - Pipe tap data to both the orchestrator (for sidetone/haptics) and UI visuals (MorseCompare).
   - Add instrumentation to flag dot/dash misclassification.
6. **QA & Operations**
   - Run on-device smoke tests across iOS/Android for all practice + lesson flows.
   - Add calibration UX (offset/latency indicators) and update developer docs.
   - Finish EAS prep (app.config.ts, env management, expo-dev-client) and script guard checks.

## Fallback Paths
- **Audio**: fall back to a minimal custom Expo Module tuned for RemoteIO/Oboe if react-native-audio-api cannot sustain the <=10 ms target.
- **Haptics**: fall back to expo-haptics on unsupported hardware while keeping Nitro as the preferred path.
- **Screen Flash**: promote overlay to a native surface if Reanimated animations stutter or rendering order fails.
- **Torch**: detect OEM throttling and gracefully degrade to screen-flash-only feedback with user messaging.
- **Keyer Input**: surface calibration controls and tap histograms if gesture thresholds remain inaccurate at higher WPM.

## Risks & Mitigations
- Library maintenance cadence - track upstream releases, pin versions, and schedule dependency audits.
- Device variability - collect telemetry per device to understand latency drift; expose toggles for disabling channels.
- Permission UX - ensure torch/audio prompts are friendly and allow practice without those channels if denied.
- JS/native divergence - rely on a single monotonic timeline and resync checkpoints to keep channels aligned.

## Related Docs & Tasks
- Refactor backlog entry: ### Outputs Rewire Plan in docs/refactor-notes.md.
- Developer console tracing updates: docs/developer-console-updates.md.
- Practice revamp will reuse the new orchestrator once complete.


