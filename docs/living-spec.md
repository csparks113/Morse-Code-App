# Morse Code Master — Living Spec

This document captures how the app is organized and behaves so changes are intentional and traceable.

## Vision & Scope

- Learn Morse code progressively using short, focused lessons with immediate audio/haptic feedback.
- Support recognizing (Receive) and sending (Send) characters, with cumulative challenges to reinforce.

## Architecture

- Expo + React Native + TypeScript + Expo Router (file-based navigation).
- Zustand stores with AsyncStorage persistence for settings and progress.
- UI components are under `components/`; app screens under `app/`.

## Navigation

- Tabs: `/(tabs)/index` (home), `/practice`, `/settings`.
- Lessons: `/lessons/[group]/overview`, `/lessons/[group]/[lessonId]/receive`, `/send`.

## State Model

- `store/useSettingsStore`: receiveOnly, audio/light/haptics toggles, `wpm`, `toneHz` with clamping.
- `store/useProgressStore`: per-lesson `send`/`receive` flags and 0–100 scores; helper `getCountsGlobal` used on Home.
- Thresholds for “completed” are centralized in `theme/lessonTheme.ts` (`receive`/`send`).

## Data Model

- `data/lessons.ts`: groups (alphabet, numbers) and lessons with `id`, `label`, `chars`.

## Timing Model

- Morse dot unit: `dot = 1200 / WPM` ms.
- Receive: autoplay uses this unit; visuals/haptics tick per symbol.
- Send: classifies press duration; current rule is `<= 2 * unit` = dot, else dash.

## Audio / Visual / Haptics

- Audio: tones generated as 16‑bit PCM mono WAV (sine) at runtime and cached.
  - File writes go through `expo-file-system/legacy` to avoid SDK 54 deprecation crash.
  - Playback via `expo-av` (noted as deprecated in SDK 54; plan to migrate to `expo-audio`).
- Visuals: optional flash overlay per symbol on Receive.
- Haptics: taps on symbol start (Receive) and on key presses (Send).

## Components (Flattened)

- `components/` contains lesson UI: `Coin`, `LessonNode`, `ChallengeNode`, `LessonPath`, `LessonPromptCard`, `NeonHeaderCard`, `ProgressBar`.
- Themes:
  - `constants/theme.ts`: app shell theme (tabs, settings, etc.).
  - `theme/lessonTheme.ts`: neon tokens for lesson visuals.
  - `constants/coinTheme.ts`: palette for coin visuals.

## Accessibility

- Buttons have roles/labels; icons used with alt labels; high‑contrast palette.

## Known Work / Roadmap

- Migrate audio generation to `expo-audio` and new File/Directory API.
- Add free practice drills and speed tests under `/practice`.
- Expand lesson set and add spaced repetition options.
- Paywall for premium features (stubbed for future).

## Contributing Notes

- Keep non-route modules out of `app/` to avoid Expo Router warnings.
- Prefer store helpers over recomputing thresholds in screens.
- Keep side effects out of render paths; use effects triggered by state changes.
