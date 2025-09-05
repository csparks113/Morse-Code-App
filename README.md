# Morse Code Master

A premium dark-themed Expo React Native app for learning, practicing, and mastering Morse code.

## Features

- Koch-style lessons for alphabet and numbers
- Practice sending and receiving Morse
- Track progress and mastery
- Adjustable WPM, tone, and input modes
- Internationalization (EN/ES/FR/DE)
- AsyncStorage persistence
- Zustand state management
- Expo Router navigation
- Paywall stub for future premium features

## Architecture Overview

- **Expo + React Native + TypeScript**: Fast development, cross-platform
- **Expo Router**: File-based navigation, tabs for main screens
- **Zustand**: Global state for settings, progress, lesson mode
- **AsyncStorage**: Persistent user data
- **i18next**: UI translations
- **expo-av**: Audio playback for Morse tones
- **Component-based UI**: LessonCard, ReceiveKeyboard, SendKeyer, ProgressBadge, HeaderMenu, Paywall
- **Theme**: Charcoal/black background, neon blue accents, gold for completion

## Run Instructions

```sh
npx expo start
```

## Folder Structure

```
app/
  (tabs)/
    _layout.tsx
    index.tsx                  ← Home: Lessons
    practice.tsx               ← Practice tab
    settings.tsx               ← Settings tab (Receive‑only toggle)
    lessons/
      [group]/
        [lessonId]/
          receive.tsx          ← Individual Receive lesson
          send.tsx             ← Individual Send lesson
        overview.tsx            ← Lesson overview for group
  _layout.tsx                  ← Root layout
  +not-found.tsx

components/
  HeaderGroupPicker.tsx
  LessonCard.tsx
  ProgressBar.tsx

constants/
  theme.ts

data/
  lessons.ts

store/
  useSettingsStore.ts          ← Zustand store (receiveOnly, etc.)

assets/
  tones/
    dot.wav
    dash.wav


## Project Documentation

We maintain a master specification and code index in ChatGPT:

👉 [Morse Code Master — Living Spec & Code Index](https://chat.openai.com/c/68ba2d82c54481918f76e07b99235977)


```
