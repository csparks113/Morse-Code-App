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
  _layout.tsx
  (tabs)/
    _layout.tsx
    lessons.tsx
    practice.tsx
    progress.tsx
    settings.tsx
  onboarding/
    index.tsx
  lesson/
    [lessonId].tsx
components/
  LessonCard.tsx
  ReceiveKeyboard.tsx
  SendKeyer.tsx
  ProgressBadge.tsx
  HeaderMenu.tsx
  Paywall.tsx
lib/
  audio.ts
  morse.ts
  store.ts
  i18n.ts
  lessons.ts
  utils.ts
assets/
  tones/
  icons/
  fonts/
```
