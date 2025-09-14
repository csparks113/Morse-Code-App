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
- **expo-av**: Audio playback for Morse tones
- **Component-based UI**: NeonHeaderCard, coin-style LessonPath, ProgressBar
- **Theme**: Charcoal/black background, neon blue accents, gold for completion

## Run Instructions

```sh
npx expo start
```

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
        receive.tsx     # Individual Receive lesson
        send.tsx        # Individual Send lesson
  components/
    Coin.tsx            # coin visuals (used by Lesson/Challenge nodes)
    LessonNode.tsx      # coin-based lesson node
    ChallengeNode.tsx   # coin-based challenge node
    ProgressBar.tsx     # compact coin summary row

components/
  lessons/
    NeonHeaderCard.tsx  # header with group picker modal
    LessonPath.tsx      # vertical path of nodes + prompts
    LessonPromptCard.tsx# actions under selected node

constants/
  theme.ts              # app shell theme

theme/
  lessonTheme.ts        # neon theme for lessons path

data/
  lessons.ts

store/
  useSettingsStore.ts
  useProgressStore.ts

utils/
  morse.ts
  audio.ts

assets/
  images/, fonts/ (tones are generated at runtime)
```
