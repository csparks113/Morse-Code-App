# Morse Code Master

A premium dark-themed Expo React Native app for learning, practicing, and mastering Morse code.

## Features

- Koch-style lessons for alphabet and numbers
- Practice sending and receiving Morse
- Track progress and mastery
- Adjustable WPM and input mode toggles (audio/light/haptics)
- Zustand state management with AsyncStorage persistence
- Expo Router navigation
- Paywall stub for future premium features (planned)

## Architecture Overview

- **Expo + React Native + TypeScript**: Fast development, cross-platform
- **Expo Router**: File-based navigation, tabs for main screens
- **Zustand + persist (AsyncStorage)**: Global state with persistence
- **expo-av**: Audio playback for Morse tones (SDK 54 deprecates this; we shim FS writes via `expo-file-system/legacy` and can migrate to `expo-audio` later)
- **Component-based UI**: NeonHeaderCard, coin-style LessonPath, ProgressBar
- **Theme**: Charcoal/black background, neon blue accents, gold for completion

## Run Instructions

```sh
npx expo start
```

## Getting Started

- Prerequisites: Node 18+, npm 9+, Android Studio (Android), Xcode (iOS), and Expo Go on your device if you’re testing on hardware.
- Install deps: `npm install`
- Start dev server: `npx expo start` (or `npx expo start -c` to clear cache)
- Open:
  - Android Emulator: press `a` in the Expo CLI
  - iOS Simulator: press `i`
  - Physical device: scan the QR code with Expo Go

## Development Tips

- Clear Metro cache: `npx expo start -c`
- Lint: `npm run lint`
- Format: `npm run format`
- Type-check: `npx tsc -noEmit`
- Dev menu: shake device, or use `Ctrl+M` (Android) / `Cmd+D` (iOS Simulator)
- Reset local state (AsyncStorage): uninstall the app or clear storage from the OS/app settings

## Troubleshooting

- SDK 54 warnings:
  - `expo-av` is deprecated; audio playback works but will be migrated to `expo-audio`.
  - `expo-file-system` legacy API is used intentionally for tone file writes to avoid runtime errors; migration to the new File/Directory API is planned.
- Routing issues: keep non‑screen modules out of `app/` so Expo Router doesn’t treat them as routes.
- If you see strange bundler errors: stop the server, run `npx expo start -c`, and try again.

## Project Documentation

We maintain a master specification:

- Local: `docs/living-spec.md`
- ChatGPT (reference-only): https://chat.openai.com/c/68ba2d82c54481918f76e07b99235977

## Folder Structure

```
app/
  _layout.tsx
  +not-found.tsx
  (tabs)/
    _layout.tsx
    index.tsx           # Home: Lessons
    practice.tsx        # Practice tab
    settings.tsx        # Settings tab (receive-only, audio/light/haptics, WPM)
  lessons/
    [group]/
      overview.tsx      # Group overview
      [lessonId]/
        receive.tsx     # Receive lesson (multiple-choice listen)
        send.tsx        # Send lesson (tap/hold keyer)

components/
  Coin.tsx              # Coin visuals (used by Lesson/Challenge nodes)
  LessonNode.tsx        # Coin-based lesson node
  ChallengeNode.tsx     # Coin-based challenge node
  LessonPath.tsx        # Vertical path of nodes + prompts
  LessonPromptCard.tsx  # Actions under selected node
  NeonHeaderCard.tsx    # Header with group picker modal
  ProgressBar.tsx       # Compact coin summary row

theme/
  theme.ts              # App shell theme (tabs, settings, etc.)
  coinTheme.ts          # Palette for coin visuals
  lessonTheme.ts        # Neon theme tokens used by lesson screens

data/
  lessons.ts

store/
  useSettingsStore.ts
  useProgressStore.ts

types/
  progress.ts

utils/
  morse.ts
  audio.ts

assets/
  images/, fonts/ (tones are generated at runtime)
```
