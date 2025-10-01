# Refactor Notes – Receive/Send Session Cleanup

## Project Vision
- Stabilize lesson session flows for easier maintenance and future feature work.
- Consolidate design tokens and session hooks ahead of rewiring outputs (audio, flashlight, haptics) to native modules for near-zero latency.
- After cleanup + native-module migration, prepare a development build for rapid iteration.
## Completed (Today)
- Centralized prompt action configuration in `hooks/useSendSession.ts` and `hooks/useReceiveSession.ts`.
- Updated send/receive screens to consume hook-provided `revealAction`/`replayAction` and removed local memoization.
- Refreshed `PromptCard` styles to use shared `promptCardTheme` tokens; added the theme block to `theme/lessonTheme.ts`.
- Ensured `npx tsc --noEmit` passes after the refactor.

## Next Steps
1. Continue consolidating session UI constants (e.g., `RevealBar`, `sessionStyles`) into shared tokens.
2. Polish hook/type documentation and consider adding lightweight tests or examples for the new `actionLabels` API.
3. Run an Expo smoke test of send/receive flows to confirm the memoized prompt actions behave correctly.
4. Audit other session components for remaining hard-coded colors/spacing.

