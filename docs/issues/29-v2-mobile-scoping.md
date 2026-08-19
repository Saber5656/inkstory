# Title

v2 scoping study: native mobile apps (deliverable = design doc + issue breakdown)

## Summary

Post-v1 planning task (not required for the v1 release): evaluate how inkstory reaches
iOS/Android app stores while preserving the fully-local privacy model, and produce
`docs/DESIGN-mobile.md` plus a v2 issue breakdown. Deliverables are documents only —
no app code.

## Context

Product-owner decision (2026-07-07): web app is the MVP; **mobile apps are a v2
target tracked in the issue plan**. The v1 architecture (client-only SPA, IndexedDB,
ORT-web, PixiJS) was chosen partly for portability into a wrapper.

## Scope

Research + written design. Candidate approaches to evaluate (at minimum):
1. **Capacitor wrapper** around the existing web core (likely default: maximal reuse);
2. Expo/React Native rewrite of UI over shared TypeScript domain/engine packages;
3. PWA-only distribution (no stores) as the null option with install-UX improvements.

## Detailed Requirements

1. Evaluation matrix across: code reuse %, camera/mic quality, on-device inference
   options (ORT native vs ORT-web in webview), storage durability (vs iOS eviction —
   likely the strongest argument for native), offline behavior, app-store policy risks
   for a kids-adjacent app (COPPA/store family-program requirements **even for a
   local-only app**), release/signing operational load, binary size, update cadence.
2. Privacy model deltas: filesystem storage vs IndexedDB, OS-level permissions copy,
   what store privacy labels must declare; confirm the "nothing leaves the device"
   pledge survives each approach.
3. Data migration/portability: `.inkstory` bundle as the bridge between web and mobile
   (validate the format suffices; list any needed format v2 fields).
4. Monorepo impact: what must be extracted into packages (`domain`, `motion`,
   `render`?) for reuse; estimate of refactor cost per approach.
5. Deliverables: `docs/DESIGN-mobile.md` (recommendation + rationale + risks),
   `docs/decisions/ADR-007-mobile-approach.md` (proposed, pending product-owner
   approval — approach selection is a human decision), and a draft issue breakdown
   appended to ISSUE_PLAN as wave 6+.
6. Every store-policy or platform claim cited to current primary sources (policies
   change; verify at execution time, not from memory).

## Acceptance Criteria

- The three approaches scored in the matrix with evidence links; one recommendation
  with explicit trade-offs.
- Privacy-pledge analysis covers all three; any approach that would break the pledge
  is marked ineligible regardless of score.
- Draft v2 issue list is granular (each ≤1 focused task) mirroring v1 conventions.
- ADR-007 exists in `Proposed` status; product-owner sign-off is listed as its
  activation condition.

## Validation

Design review by the product owner (this issue's outcome is a decision input, not
merged-as-accepted); link-check on citations.

## Dependencies

None to start; meaningful only after v1 architecture stabilizes (post wave 4
recommended).

## Non-goals

Implementing any mobile code, store account setup, v1 changes of any kind, choosing
the approach without human approval.

## Design References

DESIGN.md §2.1 (Q1 decision), §2.4; ISSUE_PLAN §7; ADR-001, ADR-005, ADR-006.
