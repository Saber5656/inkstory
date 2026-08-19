# Title

Project scaffolding: Vite + React + TypeScript workspace with lint, format, and unit-test toolchain

## Summary

Create the application skeleton and developer toolchain exactly as fixed in ADR-006 so
every later issue lands in a known structure with working quality gates.

## Context

The repository currently contains only a README. All subsequent issues assume the module
layout of DESIGN.md §4.1 and the stack of ADR-006. This issue creates that foundation —
no product features.

## Scope

- pnpm project, Vite + React 18 + TypeScript strict SPA.
- ESLint (typescript-eslint) + Prettier + Vitest + Testing Library installed and wired.
- Directory skeleton from DESIGN §4.1 (`src/app`, `src/ui`, `src/i18n`, `src/domain`,
  `src/storage`, `src/capture`, `src/vision`, `src/pose`, `src/rig`, `src/motion`,
  `src/render`, `src/book`, `src/audio`, `src/exchange`, `src/pwa`, `src/diagnostics`,
  `tools/`, `tests/fixtures/`) with placeholder `index.ts` files.
- MIT `LICENSE`, `.editorconfig`, `.gitignore`, `.npmrc` with `ignore-scripts=true`.

## Detailed Requirements

1. `pnpm create vite` equivalent setup: `react-ts` template, `"strict": true`,
   `"noUncheckedIndexedAccess": true`, path alias `@/* → src/*`.
2. Scripts in `package.json`: `dev`, `build`, `preview`, `lint`, `format:check`,
   `typecheck` (`tsc --noEmit`), `test` (vitest run), `test:watch`.
3. ESLint flat config: typescript-eslint recommended-type-checked, react-hooks,
   `no-restricted-syntax` rule banning `dangerouslySetInnerHTML` (DESIGN §10.3) and
   `eval`.
4. Prettier defaults (2-space, single quotes); no conflicting ESLint style rules.
5. Vitest configured with `environment: 'jsdom'`, setup file registering
   `@testing-library/jest-dom`; one passing smoke test (`src/app/App.test.tsx`).
6. `index.html` in Japanese default lang (`<html lang="ja">`), app title "inkstory".
7. Commit `pnpm-lock.yaml`. Node engine `>=20` declared in `package.json`.
8. `.npmrc`: `ignore-scripts=true` (DESIGN §10.3 supply-chain control). Document in a
   root `CONTRIBUTING.md` stub how to run the toolchain.

## Acceptance Criteria

- `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
  all succeed on Node 20 with no warnings treated as errors disabled.
- `pnpm dev` serves a page rendering the string `inkstory` .
- ESLint fails a file containing `dangerouslySetInnerHTML` (verified by a fixture test
  in the ESLint config's own test or a temporary file during review).
- Directory skeleton matches DESIGN §4.1 exactly.

## Validation

Run the command chain above; screenshot dev server page; run
`git ls-files | sort` and diff against the layout list in this issue.

## Dependencies

None (first issue).

## Non-goals

CI workflows (issue 02), routing/i18n (issue 03), any product feature.

## Design References

DESIGN.md §4.1, §10.3, §12; ADR-006.
