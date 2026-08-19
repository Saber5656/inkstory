# Title

Domain entities and zod schemas (strict) with validation tests

## Summary

Implement every v1 entity from DESIGN §7.1 as TypeScript types derived from
`zod.strict()` schemas, including the bounds that DESIGN §10.3 relies on, plus shared
constants (skeleton definition).

## Context

Schemas are the single validation source at every boundary: IndexedDB reads, `.inkstory`
import, motion JSON loading. Getting bounds and strictness right here is a security
control, not a convenience (DESIGN §10.3 rows "Stored XSS", "Malicious motion/rig JSON").

## Scope

`src/domain/`: `schemas.ts`, `types.ts` (inferred), `skeleton.ts`, `ids.ts`, unit tests.
No UI, no storage.

## Detailed Requirements

1. Schemas for: BlobRecord, Drawing, Character, CharacterRig, Book, Page, Settings,
   MotionClip, ExportManifest — fields, enums, and limits exactly as DESIGN §7.1, §6.2,
   §7.3. All object schemas use `.strict()`.
2. Bounds (reject outside): name ≤50 chars, title ≤100, page text ≤500, `effectIds` ≤3,
   rig joints = exactly the 16 named joints, mesh vertices ≤ 3000×2 numbers, triangles
   ≤ 6000×3 integer indices and every triangle index must be within `mesh.vertices`,
   weights ≤2 influences/vertex with every `boneIndex` within the skeleton bone table
   and `w ∈ [0,1]`, motion
   `frameCount ∈ [2, 3600]`, `fps ∈ {24,30,60}`, angles finite numbers in
   `[-100000, 100000]` (post-parse normalization to [-180,180] is the consumer's job),
   `rootTranslation.length === frameCount`, every `frames[bone].length === frameCount`.
   All numeric fields `.finite()` (NaN/Infinity rejected).
3. `skeleton.ts`: the 16-joint table (name, parent) and 15 bone ids (child-joint naming)
   from DESIGN §6.1 as `const` data with derived types; helper `boneChain(root)` for FK
   order.
4. `ids.ts`: UUIDv4 generation (`crypto.randomUUID`) + id schema (`z.string().uuid()`).
5. Motion clip id pattern `^[a-z0-9_]{1,32}$`; locale-keyed name/keyword records
   restricted to `ja`/`en` keys.
6. Export helpers: `parseOrThrow(schema, data, context)` producing a typed error with a
   JSON-pointer-ish path (used by import UI in issue 22).
7. No runtime dependency other than zod.

## Acceptance Criteria

- Table-driven tests: for each schema ≥1 valid fixture and ≥5 invalid fixtures
  (extra key, over-limit string, NaN, wrong enum, missing field) — all behave as
  specified.
- A fixture rig with 15 or 17 joints is rejected; exactly-16 with correct names passes.
- A fixture rig with out-of-range triangle indices, non-integer triangle indices, or
  weight `boneIndex` values outside the skeleton bone table is rejected.
- A motion fixture where one bone track length ≠ frameCount is rejected
  (cross-field refinement).
- `types.ts` exports compile-time types inferred from schemas only (no hand-written
  duplicates).

## Validation

`pnpm test src/domain` green; mutation-style spot check: flip one bound (e.g., text 501)
and observe the test suite catch it.

## Dependencies

01.

## Non-goals

Persistence (05), import/export IO (22), COCO mapping (12 — it consumes `skeleton.ts`).

## Design References

DESIGN.md §6.1, §6.2, §7.1, §7.3, §10.3; ADR-002.
