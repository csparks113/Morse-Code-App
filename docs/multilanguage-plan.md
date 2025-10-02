# Multi-language Expansion Plan

## Goals
- Support swapping the entire UI and lesson content to a new language through the existing Settings screen.
- Streamline the process of adding languages that use the Latin alphabet (including diacritics).
- Ensure every surface (send/receive lessons, developer tools, practice, docs) pulls copy and assets from language packs.

## Required Workstreams
1. **Localization Infrastructure**
   - Audit existing files for hard-coded strings and migrate them into the i18n resource bundles.
   - Introduce translation keys for lesson metadata, prompts, developer console text, etc.
   - Add language selection handling to settings, persisting user choice across sessions.

2. **Keyboard Layouts & Input**
   - Define per-language keyboard layouts (characters + diacritics).
   - Update lesson components so they load the appropriate keyboard layout based on the active language.
   - Ensure keyer input and MorseCompare visuals render new glyphs correctly.

3. **Lesson Content**
   - Extend the lessons data model to include language-specific character sets, word lists, and sentence flows.
   - Generate/curate new character lessons (e.g., letters with diacritics).
   - Rebuild the Words/Sentences subsections for each language using localized content.

4. **UI & Copy Updates**
   - Localize titles, explanations, error messages, and settings labels.
   - Update docs where workflow guidance changes per language.
   - Confirm animations/layouts handle longer strings and diacritical marks.

5. **Tooling & QA**
   - Add a localization checklist covering translations, keyboards, lesson data, and smoke tests.
   - Integrate lint/check scripts to flag untranslated strings.
   - Provide developer guidance for adding a new language pack (docs/how-to).

## Open Questions
- Do we release languages incrementally (feature flag per language) or all at once?
- How do we handle audio pronunciations or textual explanations per language?
- Do we need language-specific analytics or progress tracking adjustments?
