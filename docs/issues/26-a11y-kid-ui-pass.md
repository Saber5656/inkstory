# Title

Accessibility and kid-safety UI pass across all screens

## Summary

Systematically apply and verify DESIGN §8.7 across every surface built in issues 03–21:
contrast, focus, labels, keyboard paths, touch targets, reduced-motion coverage, and
the kid-safety interaction rules.

## Context

Individual issues carry their own a11y requirements; this pass verifies the whole
product coherently and fixes gaps — a dedicated gate so a11y cannot silently erode
across 15+ UI PRs.

## Scope

Audit + fixes only (no new features): all routes in DESIGN §8.1; shared components in
`src/ui/`; automated a11y checks added to the test suites.

## Detailed Requirements

1. Automated: add `axe-core` (via vitest-axe or Playwright-axe) checks for every route
   in default state — zero serious/critical violations; add `eslint-plugin-jsx-a11y`
   (recommended set) to the lint config.
2. Parent-facing screens (library, wizard, editor, settings, about): WCAG 2.1 AA
   contrast on text and meaningful UI (verify token palette; adjust tokens if any pair
   fails — tokens change goes through 03's file), visible focus indicators, labeled
   inputs (`aria-label`/`<label>`), dialogs with focus trap + `Esc`, toasts announced
   via `aria-live=polite`.
3. Keyboard-only paths verified and fixed where broken: full wizard (incl. crop
   nudging 07, mask tool switching 09, joint pin selection+arrow move 12), book
   editing (18/19 incl. reorder), import/export flows (22).
4. Touch targets: audit every interactive element ≥48 px (player controls ≥64 px);
   fix via shared token classes.
5. Kid-safety rules verified product-wide (DESIGN §10.5): destructive actions behind
   confirm dialogs naming the target (character name / book title + counts); player
   hold-to-exit; no external links reachable from kid-facing surfaces (`/about` is the
   only screen with links — verify it's not reachable from the player); audio never
   autoplays outside the player.
6. Reduced-motion sweep: `prefers-reduced-motion` honored on every animation site
   (page transitions, toasts, marching ants, onboarding, effects via 17) — inventory
   table in the PR.
7. Language: `<html lang>` switches with locale (03); screen-reader spot-check of the
   wizard in ja and en (VoiceOver or NVDA — notes in PR).
8. Deliver `docs/ops/a11y-checklist.md`: per-screen checklist with status, kept as the
   regression checklist for future releases.

## Acceptance Criteria

- axe suites green on all routes; jsx-a11y lint green.
- Keyboard-only recording (or step list) completing: create character (manual path),
  compose 2-page book, export — attached to PR.
- Touch-target audit table shows 100% compliance.
- Kid-safety rule spot-checks documented (incl. toddler-mash test reference from 21).

## Validation

CI (axe + lint); manual screen-reader + keyboard passes documented in
`docs/ops/a11y-checklist.md`.

## Dependencies

16, 19, 21 (audits the shipped surfaces; runs late in wave 4).

## Non-goals

New features, full WCAG AAA, localization beyond ja/en, dark mode.

## Design References

DESIGN.md §8.6, §8.7, §10.5.
