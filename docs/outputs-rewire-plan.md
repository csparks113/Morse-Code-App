# Outputs Rewire Plan

## Selected Stack
- **Audio**: @siteed/expo-audio-studio for low-latency playback (preloaded PCM buffers, Expo-compatible).
- **Haptics**: react-native-nitro-haptics (TurboModule) as primary path; expo-haptics as safety fallback.
- **Screen Flash**: Reanimated 3 UI-thread animations powering the FlashOverlay layer.
- **Torch**: expo-torch (or expo-camera torch helper) with permission gating and warm start.

## Integration Phases
1. **Foundations & Benchmarks**
   - Confirm all dependencies support Expo's New Architecture (RN =0.73, Expo SDK =51).
   - Capture current latency metrics across devices for audio/haptics/flash/torch and keyer input.
   - Finalize API contract for the outputs orchestrator (prepare/start/stop/tap events, telemetry callbacks).
2. **Audio + Haptics**
   - Install @siteed/expo-audio-studio and react-native-nitro-haptics.
   - Preload dit/dah/sidetone buffers; expose warm-up hook to avoid first-call lag.
   - Map orchestrator calls to native fire-and-forget triggers; capture success/failure events for tracing.
3. **Visual Channels**
   - Rebuild FlashOverlay with Reanimated UI worklets so animations run off the JS thread.
   - Add torch controller via expo-torch with permission checks, warm initialization, and throttling guards.
4. **Orchestration Layer**
   - Introduce an OutputsOrchestrator service that generates unified channel timelines and proxies to the native modules.
   - Rewire send/receive hooks (useSendSession, useReceiveSession, useKeyerOutputs) plus toggles to call the orchestrator.
   - Preserve developer tracing by emitting outputs.* events from the orchestrator.
5. **Keyer Precision**
   - Replace keyer button logic with eact-native-gesture-handler press tracking + high-resolution timing.
   - Pipe tap data to both the orchestrator (for sidetone/haptics) and UI visuals (MorseCompare).
   - Add instrumentation to flag dot/dash misclassification.
6. **QA & Operations**
   - Run on-device smoke tests across iOS/Android for all practice + lesson flows.
   - Add calibration UX (offset/latency indicators) and update developer docs.
   - Finish EAS prep (app.config.ts, env management, expo-dev-client) and script guard checks.

## Fallback Paths
- **Audio**: escalate to react-native-audio-api or author a focused Expo Module if @siteed/expo-audio-studio misses targets.
- **Haptics**: fall back to expo-haptics on unsupported hardware while keeping Nitro as the preferred path.
- **Screen Flash**: promote overlay to a native surface if Reanimated animations stutter or rendering order fails.
- **Torch**: detect OEM throttling and gracefully degrade to screen-flash-only feedback with user messaging.
- **Keyer Input**: surface calibration controls and tap histograms if gesture thresholds remain inaccurate at higher WPM.

## Risks & Mitigations
- Library maintenance cadence ? track upstream releases, pin versions, and schedule dependency audits.
- Device variability ? collect telemetry per device to understand latency drift; expose toggles for disabling channels.
- Permission UX ? ensure torch/audio prompts are friendly and allow practice without those channels if denied.
- JS/native divergence ? rely on a single monotonic timeline and resync checkpoints to keep channels aligned.

## Related Docs & Tasks
- Refactor backlog entry: ### Outputs Rewire Plan in docs/refactor-notes.md.
- Developer console tracing updates: docs/developer-console-updates.md.
- Practice revamp will reuse the new orchestrator once complete.
