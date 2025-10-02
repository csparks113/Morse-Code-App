# Lessons Tab Restructure

## Overview
Reorganise the Lessons tab into five top-level sections to showcase overall progress and provide quick access to subsections. The existing send/receive lesson paths remain, but navigation will be updated to support a section > subsection > lesson flow.

## Top-Level Sections
1. **Characters**
   - Alphabet (A–Z)
   - Numbers (0–9)
   - Punctuation (period, comma, ?, /, -, =, +, etc.)
2. **Words & Sentences**
   - Common words (high-frequency + ham terms)
   - Practical phrases (call signs, RST reports, QTH + name, weather)
   - Sentences/QSO scripts (CQ calls, exchanges, short QSOs)
3. **Prosigns**
   - Turn-taking (AR, K, KN, BK, R, SK)
  - Special use (AS, BT, CL, SOS, HH, etc.)
4. **Q-codes**
   - Etiquette (QRL, QRZ, QRV, QRX, QRT)
   - Signals/conditions (QRN, QRM, QSB, QRO, QRP, QSK)
   - Logistics (QSY, QTH, QSO, QSL, QTR, QRG)
5. **Abbreviations**
   - Call basics (CQ, DE, PSE, TNX, AGN, HW?, R)
   - Personal info (NAME, OP, QTH, WX, RIG, ANT, PWR)
   - Everyday chatter (FB, GM/GA/GE, CU/CUL, UR, VY, DR, ES)
   - Endings & culture (73, 88, GL, GB, OM, YL, XYL, TU, HI)

## UX Requirements
- Keep the current Lessons header layout (e.g., "Section 1" / "Alphabet").
- Update the hamburger button to open a full-screen modal or navigate to a new "Sections" screen that lists the five top-level sections with their progress bars.
- Selecting a section reveals its subsections (accordion/slide-down). Choosing a subsection navigates to the existing lesson path view.
- Persist progress calculations per section and subsection, leveraging the existing progress helpers where possible.

## Implementation Notes
- Define new data structures for sections/subsections (e.g., in data/lessons or similar).
- Update navigation routes for the Lessons tab to support section/subsection params.
- Refresh any analytics/events to account for the new hierarchy.
- Ensure guard rails (style guard, spacing tokens) apply to new UI surfaces.

## Open Questions
- Do we surface subsection summaries (e.g., learned/streak stats) in the selector view?
- Should users be able to reorder or hide sections once mastered?
- How does this structure map to future practice tab content?
