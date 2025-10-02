# Practice Modes Revamp

## Goals
- Rebuild the Practice tab with three distinct modes (Timing, Target, Custom) and themed visuals.
- Provide intermediate setup screens so users can configure drills before entering the practice surface.
- Reuse lesson screen patterns while allowing new components (timing graphs, weak-spot decks).
- Make adding future practice modes straightforward via modular data/config.

## Tab Overview
- Header: Practice (neutral background, no XP indicators).
- Cards:
  - **Timing Practice** (blue/purple gradient, stopwatch icon, copy: "Sharpen your rhythm with dot, dash, and spacing drills").
  - **Target Practice** (orange/red gradient, target icon, copy: "Fix weak spots with focused send or receive exercises").
  - **Custom Practice** (green gradient, pencil icon, copy: "Choose your own characters, words, or phrases to train").
- Tapping a card navigates to the corresponding setup flow.

## Mode Setup Screens
### Timing Practice Setup
- Options: Drill type (dots, dashes, mixed, word rhythm), Speed (WPM), Duration (reps/mins).
- CTA: Start Timing Practice.

### Target Practice Setup
- Options: Mode (Send/Receive), Content source (auto weak spots + manual lesson selection), Speed, Duration.
- CTA: Start Target Practice.

### Custom Practice Setup
- Step 1: Mode (Send/Receive).
- Step 2: Content type toggles (Characters, Words, Sentences).
- If Characters: choose categories (Alphabet, Numbers, Punctuation) and specific glyphs via keyboard grid.
- If Words: pick from lesson words or input custom.
- If Sentences: pick from presets or input custom text.
- Global: Speed, Duration.
- CTA: Start Custom Practice.

## Practice Drill Screens
### Timing Practice
- Background accent: blue/purple.
- Target rhythm graph (scrolling right ? left) and user attempt graph aligned with a center playhead.
- Feedback: live accuracy %, tips (e.g., "Dashes too short").
- Standard output toggles (audio/haptics/flash/torch).

### Target Practice
- Send: similar to lesson send screen (prompt card, keyer, weak-spot feedback breakdown).
- Receive: similar to lesson receive screen (playback + answer input, feedback percentages).
- Accent: orange/red.

### Custom Practice
- Mirrors Target mode but uses user-selected content deck.
- Accuracy displayed but does not affect lesson progression.
- Accent: green.

## Infrastructure Considerations
- Define mode registry/config so new practice modes can be added with minimal wiring.
- Share outputs service + toggles (reuse orchestrator).
- Shared components: practice card list, setup forms, stats panels.
- Update analytics to track drill usage/performance per mode.

## Open Questions
- Do we allow saving preset configurations for quick launch?
- How do we surface weak-spot suggestions (Target mode) in the setup flow?
- Should timing practice unlock higher speeds automatically?
- Any onboarding/tutorial content needed for first-time use?
