# Morse Code Master - Living Spec

This document captures how the app is organized and behaves so changes are intentional and traceable.

## Vision & Scope

- Learn Morse code progressively using short, focused lessons with immediate audio, visual, and haptic feedback.
- Support recognising (Receive) and sending (Send) characters with cumulative challenges to reinforce skills.

## Architecture

- Expo + React Native + TypeScript running in the bridgeless New Architecture (Hermes) runtime.
- Nitro modules live under `outputs-native/` and provide the Android audio backend plus shared bindings.
- Expo Router powers navigation; screens live under `app/` and UI components under `components/`.
- Zustand stores with AsyncStorage persistence back settings and learner progress.

## Navigation

- Tabs: `/(tabs)/index` (home), `/practice`, `/settings`.
- Lessons: `/lessons/[group]/overview`, `/lessons/[group]/[lessonId]/receive`, `/send`.

## State Model

- `store/useSettingsStore`: receiveOnly, audio/light/haptics toggles, `wpm`, `toneHz` with clamping.
- `store/useProgressStore`: per-lesson `send`/`receive` flags and 0-100 scores; helper `getCountsGlobal` feeds Home summaries.
- Thresholds for "completed" live in `theme/lessonTheme.ts` (`receive`/`send`).

## Data Model

- `data/lessons.ts`: lesson groups (alphabet, numbers) and lesson definitions with `id`, `label`, and `chars`.

## Timing Model

- Morse dot unit: `dot = 1200 / WPM` ms.
- Receive: autoplay uses the dot unit; visuals/haptics tick per symbol.
- Send: classifies press duration; current rule is `<= 2 * unit` = dot, else dash. Upcoming work will refine high-WPM accuracy.

## Outputs Stack

- **Audio (Android)**: Nitro `OutputsAudio` (C++ hybrid in `outputs-native/android/c++`) streams tone playback on the native thread with Oboe, and now exposes native symbol timestamps so JS scheduling stays aligned with the audio clock. Env toggles (`EXPO_FORCE_NITRO_OUTPUTS`, `EXPO_DISABLE_NITRO_OUTPUTS`) control fallback to the Audio API path for diagnostics.
- **Haptics**: Bridgeless Nitro haptics module handles keyer and playback feedback; Expo haptics remains the guard fallback.
- **Flash**: Receive/playback flows animate the flash overlay via Reanimated UI thread worklets.
- **Torch**: Torch pulses go through the existing Expo module with capability checks surfaced in developer mode.
- **Telemetry**: `[outputs-audio]` and `keyer.*` traces log warm-up, scheduling, and classification details; developer console exports summarise per-channel latency.

## Components (Flattened)

- Key components: LessonCard, LessonPath, PromptCard, SessionHeader, SessionSummary, NeonHeaderCard.
- Themes:
  - `constants/theme.ts`: app shell theme (tabs, settings, etc.).
  - `theme/tokens.ts`: shared palette/spacing/typography.
  - `theme/lessonTheme.ts`: neon tokens for lesson visuals.

## Accessibility

- Buttons expose roles/labels; icons have accessibility labels; colour palette maintains contrast.

## Roadmap Highlights

- Align developer console **Play Pattern** replay so tone/flash/haptic/torch stay within ~5 ms.
- Harden send keyer classification at higher WPM with adaptive thresholds and regression guards.
- Restructure the lessons tab into sections/subsections with progress tracking aligned to the new data model.
- Expand practice modes (Timing/Target/Custom) once the outputs orchestrator and telemetry guardrails are in place.
- Deliver full multi-language support with per-language keyboards, localized content, and QA checklists.
- Validate Nitro parity on iOS using the bridgeless dev client checklist.

## Known Issues

- Developer console **Play Pattern** still shows ~30-40 ms average drift between audio and flash/haptics; further native scheduling tweaks are underway to close the remaining gap.
- Send keyer misclassifies dot-leading sequences (for example `...-`) at higher WPM; timing heuristics require refinement.

## Contributing Notes

- Keep non-route modules out of `app/` to avoid Expo Router warnings.
- Prefer store helpers over recomputing thresholds in screens.
- Keep side effects out of render paths; rely on effects triggered by state changes.
- Update this spec alongside major architecture changes so onboarding stays accurate.
