# Title

Sample content and first-run onboarding

## Summary

Ship an original sample character and a 3-page sample book that load on first run, plus
a lightweight onboarding overlay, so the very first launch demonstrates the product
before the user scans anything.

## Context

Journey A begins with "sample book plays" (DESIGN §3). Samples must be **original
project-created artwork** (a hand-drawn-style character drawn for this repo — not from
the Amateur Drawings dataset, avoiding real children's artwork; DESIGN §12 fixture
policy) and double as E2E fixtures (27).

## Scope

`public/samples/` (character texture + rig + book JSON + pre-recorded narration is NOT
included — text-only sample pages), first-run seeding logic, onboarding overlay,
"restore samples" in settings.

## Detailed Requirements

1. Sample character "いんくちゃん": original marker-style humanoid drawing (created for
   the repo, source PNG + author note committed under `assets-src/samples/`); processed
   through the real pipeline (mask, joints, rig) with the resulting rig JSON checked in
   (regeneration script documented). Rig must be schema-valid and within issue-13
   bounds.
2. Sample book (3 pages, ja + en seed variants selected by locale at seed/restore time):
   p1 meadow + wave + greeting text; p2 sky + jump + 「じゃんぷ！」-style text
   (suggestion-consistent with 19's engine); p3 night + sit_down + goodnight text; all
   `advance:'auto'`, no narration (recording is the family's first activity —
   onboarding points at it).
3. First-run seeding: on first launch (settings flag absent) copy samples into
   IndexedDB via the standard repos (fresh UUIDs), set flag; deletion by the user is
   respected (no re-seed); settings offers "サンプルをもどす" (restore) which re-seeds
   fresh copies.
4. Onboarding overlay on first `/` visit: 3 localized cards — "watch the sample book" →
   deep-link to player; "make your own" → wizard; "your voice" → hint at narration;
   dismiss = never again (settings flag). No modal walls anywhere else; overlay
   skippable instantly.
5. Samples excluded from export by default (checkbox states "include samples" off) —
   avoids sample-noise in family backups (22's selector gains the flag).
6. Everything localized; seed text comes from locale resources, not hardcoded. After a
   sample book is copied into IndexedDB it is normal user-editable `Page.text`, so later
   app locale changes do not mutate existing sample pages. Restore uses the current
   locale and creates fresh localized copies.

## Acceptance Criteria

- Fresh profile: first launch shows onboarding; sample book plays end-to-end
  (auto-advance) without any user data; second launch shows neither onboarding nor
  duplicate samples.
- Delete samples → relaunch: not re-seeded; settings restore brings them back.
- Sample rig passes issue-04 schema + issue-13 structural checks in CI.
- Locale behavior is implementable: first-run seeding uses the active locale, changing
  app locale later does not rewrite existing user/sample `Page.text`, and restore uses
  the current locale for newly seeded copies.

## Validation

`pnpm test src/app/onboarding src/samples`; Playwright fresh-profile scenario;
manual: first-run feel check on a phone — recording in PR.

## Dependencies

16, 21.

## Non-goals

Tutorial videos, sample narration audio, multiple sample characters (one is enough for
v1), marketing copy.

## Design References

DESIGN.md §3 (journey A), §8.1 (`/` states), §12 (fixture policy); ADR-002 #5.
