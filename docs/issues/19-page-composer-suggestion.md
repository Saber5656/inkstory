# Title

Page composer: character/background/text editing, motion suggestion engine, live preview

## Summary

Implement per-page editing (DESIGN §8.2) — character picker, background picker, story
text, motion picker with suggestion-first ordering, effect chips, advance mode — plus
the pure `suggestMotions` engine (DESIGN §8.3) that makes characters "move to match the
story" without AI.

## Context

This is the product-owner's core book-mode requirement (decision Q3, DESIGN §2.1): text
drives motion. The suggestion engine is deterministic keyword matching over clip
metadata (14).

## Scope

`src/domain/suggestMotions.ts` (+tests), composer UI in the editor's right pane, page
live preview (Pixi, reusing StageScene composition per §8.4 layout).

## Detailed Requirements

1. `suggestMotions(text, locale, clips) → MotionId[]` exactly per DESIGN §8.3:
   NFKC-normalize + lowercase; ja = substring match per keyword; en = word-boundary
   regex per keyword (escape metacharacters); score = Σ(matched keyword length);
   stable tie-break by clip id; top 4; empty/no-match → `[ 'idle_breathe' ]` + category
   defaults. Table-driven tests: ≥12 ja cases (incl. hiragana/katakana/kanji variants
   present in clip keywords, e.g. 「はしって いったよ」→ run first) and ≥8 en cases;
   determinism test (same input → same output array).
2. Composer sections (in order): character picker (thumb grid + "none" for
   scenery-only pages), background picker (16's catalog), text area (≤500 chars,
   counter, auto font-size preview tiers 3), motion picker (suggested chips first with
   a "おすすめ" badge, then all clips grouped by category; hidden for cutout/none
   character where effect chips take the slot), effect chips (17's registry, ≤3),
   narration slot (issue 20 mounts here; placeholder), advance mode toggle
   (tap / auto — DESIGN §8.6 semantics).
3. Suggestions recompute on text change (debounced 300 ms) but **never overwrite** an
   explicit user motion choice (dirty flag per page; suggestion only auto-applies while
   the page's motion is unset).
4. Live preview: the §8.4 fixed layout (background full-bleed, character band, text
   panel) rendered in the composer at ~40% scale, playing the selected motion + effects
   (paused state honors reduced-motion); this preview component is the same one the
   player (21) uses — build it here as `PageView` with a `mode: 'preview'|'play'` prop.
5. Text panel typography: 3 font-size tiers by length (≤80 / ≤200 / ≤500 chars),
   UD-friendly rounded font stack (system fonts only — no webfonts per ADR-005/CSP),
   max 3 visible lines scroll-free at tier 1.
6. All fields autosave through 18's store; schema bounds enforced at input level too
   (maxLength attrs).

## Acceptance Criteria

- Suggestion test suites pass; suggested chip order visibly matches engine output
  (component test).
- Typing 「じゃんぷ！」 on a fresh page auto-selects `jump`; changing motion manually
  then editing text does NOT change the selection (dirty-flag test).
- PageView renders the exact §8.4 layout at 3 viewport shapes (screenshot set).
- A page with no character (scenery) composes text-over-background without errors.

## Validation

`pnpm test src/domain/suggestMotions src/book/composer`; manual: compose the 3-page
sample story (25's script) end-to-end — recording in PR.

## Dependencies

14, 15, 18.

## Non-goals

Narration recording internals (20), player chrome (21), multi-character pages (v2),
free layout (v2).

## Design References

DESIGN.md §2.1 (Q3), §8.2–§8.4, §8.6; ADR-005 (no webfonts).
