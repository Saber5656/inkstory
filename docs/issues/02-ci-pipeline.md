# Title

CI quality gates and supply-chain baseline (GitHub Actions)

## Summary

Add the CI pipeline that every PR must pass, plus the dependency-security baseline
(audit gate, Dependabot, pinned actions) required by DESIGN §10.3.

## Context

DESIGN §12 makes CI the enforcement point for per-issue validation; DESIGN §10.3 rows
"SW/update poisoning" and "dependency compromise" name CI controls. This issue creates
them once so later issues only add jobs/steps.

## Scope

- `.github/workflows/ci.yml` for PRs and pushes to `main`.
- `.github/dependabot.yml`.
- Documentation of the branch-protection expectations (settings themselves are manual).

## Detailed Requirements

1. `ci.yml` jobs (Node 20, pnpm cache):
   - `quality`: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm format:check`,
     `pnpm typecheck`, `pnpm test` (with coverage summary output).
   - `build`: `pnpm build`; upload `dist/` as artifact; print gzip size of the largest
     entry JS chunks (budget wiring for DESIGN §9.4 comes in issue 23).
   - `audit`: `pnpm audit --prod --audit-level high` — failing on high/critical.
2. **All third-party actions pinned by full commit SHA** (not tags) with a version
   comment (DESIGN §10.3).
3. `permissions:` block at workflow level set to `contents: read` (least privilege).
4. `dependabot.yml`: weekly `npm` + `github-actions` update PRs, grouped minor/patch.
5. `concurrency` group cancels superseded PR runs.
6. Add a `docs/ops/branch-protection.md` note listing required checks (`quality`,
   `build`, `audit`) and "no direct push to main / no force push" — for the human
   admin to apply in repo settings (agents must not change repo settings).

## Acceptance Criteria

- A PR touching only a README line runs all three jobs and passes in <5 minutes.
- Introducing a dependency with a known high-severity advisory (test locally with
  `pnpm audit` simulation) fails the `audit` job.
- `grep -R "uses:" .github/workflows | grep -v '@[0-9a-f]\{40\}'` returns nothing.
- Dependabot config validates (GitHub UI shows it active).

## Validation

Open a scratch PR; attach the Actions run URL. Run the grep above in CI itself as a
step (`lint-workflows`) so the pin rule is self-enforcing.

## Dependencies

01.

## Non-goals

Deploy workflow (issue 28), E2E in CI (issue 27), bundle-size budgets (issue 23).

## Design References

DESIGN.md §9.4, §10.3 (B6/B7 rows), §12; ADR-006.
