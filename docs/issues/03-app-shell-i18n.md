# Title

App shell: routing, layout, theme tokens, i18n (ja/en), error boundary, settings skeleton

## Summary

Build the navigable empty application: all routes from DESIGN §8.1 with placeholder
screens, i18next with complete externalized strings, base theme, and a global error
boundary.

## Context

Every feature issue mounts into this shell. Locking routes, i18n discipline, and theme
tokens now prevents divergence across the ~20 UI issues that follow.

## Scope

`src/app/` (router, providers, error boundary), `src/ui/` (tokens, base components:
Button, Card, Dialog, Toast), `src/i18n/` (setup + `ja.json`, `en.json`), settings
screen skeleton with language switcher.

## Detailed Requirements

1. react-router routes exactly as DESIGN §8.1: `/`, `/characters/new`,
   `/characters/:id`, `/books/:id/edit`, `/books/:id/play`, `/settings`, `/about`.
   Placeholder components render the route name via i18n keys.
2. Library screen (`/`) has Characters/Books tabs with localized empty states
   (content wired in later issues).
3. i18next + react-i18next: `ja` default, `en` fallback chain `en→ja`; detection order:
   settings value (from storage once issue 05 lands — until then localStorage key
   `inkstory.locale`), then `navigator.language`.
4. **String discipline:** no user-visible literal strings in TSX. Add an ESLint rule
   (eslint-plugin-i18next or equivalent `no-literal-string` config scoped to `src/**`,
   excluding tests) enforcing it.
5. Theme: CSS Modules + CSS custom properties in `src/ui/tokens.css` — color palette
   (paper-cream background, crayon accent set), spacing scale, radius scale, type scale
   (min body 16px), dark mode NOT in v1. Touch target helper class ≥48px (DESIGN §8.7).
6. Global error boundary: friendly localized error screen with "reload" and
   "copy error details" (no auto-reporting — ADR-005); route-level Suspense fallbacks.
7. Lazy-route code splitting so heavy chunks (Pixi/ORT later) stay out of the shell
   (DESIGN §9.4 budget).
8. Settings skeleton: language selector (applies immediately, persists), app version
   display (from `import.meta.env`), placeholder sections for storage/diagnostics.

## Acceptance Criteria

- Navigating to each §8.1 route renders its localized placeholder in ja and en.
- Switching language in settings persists across reload.
- ESLint fails on a TSX literal user-visible string (fixture check).
- Throwing inside a route shows the error boundary, app recovers via "reload".
- `pnpm build` initial JS (shell only) ≤150 KB gz at this stage (headroom for §9.4).

## Validation

Vitest component tests: router renders each route; language switch updates `<html lang>`.
Manual: keyboard-only navigation reaches all routes (DESIGN §8.7).

## Dependencies

01.

## Non-goals

Real screen content, storage-backed settings (05), PWA (23), a11y audit pass (26).

## Design References

DESIGN.md §8.1, §8.7, §9.4; ADR-006.
