# Refactor Notes - Receive/Send Session Cleanup

## Project Vision
- Stabilize lesson session flows for easier maintenance and future feature work.
- Consolidate design tokens and session hooks ahead of rewiring outputs (audio, flashlight, haptics) to native modules for near-zero latency.
- After cleanup + native-module migration, prepare a development build for rapid iteration.

## Completed (Today)
- Centralized prompt action configuration in `hooks/useSendSession.ts` and `hooks/useReceiveSession.ts`.
- Updated send/receive screens to consume hook-provided `revealAction`/`replayAction` and removed local memoization.
- Refreshed `PromptCard` styles to use shared `promptCardTheme` tokens; added the theme block to `theme/lessonTheme.ts`.
- Ensured `npx tsc --noEmit` passes after the refactor.
- Introduced `sessionControlTheme` tokens and refactored session controls to consume shared sizing constants.

## Roadmap (Next Few Days)

### Session UI Cleanup
1. Finish migrating session control styles (ActionButton, OutputToggle, KeyerButton, ChallengeKeyboard, LessonChoices) into a shared `sessionControlTheme`.
2. Standardize footer spacing/tokens so send, receive, summary, and upcoming dev/practice screens use the same layout primitives.
3. Capture these rules in this document and set up a lint/check to warn on new hard-coded colors/spacing.

### Output Architecture Preparation
1. Inventory current output touchpoints (audio, haptics, flash overlay, flashlight) and note timing/latency issues.
2. Introduce an `OutputsService` interface (playTone, pulseFlash, triggerHaptics, etc.) and retrofit existing hooks/utilities to consume it.
3. Add light instrumentation hooks (timing, diagnostics) routed through a toggle-able debug channel, ready for developer mode.

### Developer Mode Shell
1. Implement feature-flag plumbing and an initial Developer Console route using the session layout primitives.
2. Wire the console to the new outputs service so future low-latency/native modules can expose controls (flashlight tester, latency meter).
3. Document how to toggle/dev-launch the console for future contributors.

### Practice-Tab Groundwork
1. Outline shared components the practice tab will reuse (keyboards, summary cards, toggles) and ensure they’re tokenized.
2. Stub navigation/data structures for practice flows so upcoming work is additive.
3. Collect TODOs/ideas for practice content in a dedicated section of this doc.

### Hygiene & Guardrails
1. Extend docs with session UI conventions and outputs service architecture notes.
2. Prepare an Expo smoke-test checklist (send, receive, summary) to run after major changes.
3. Add simple mocks/tests around the outputs service to protect against regressions during rewrites.

