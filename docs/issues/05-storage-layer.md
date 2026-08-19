# Title

IndexedDB storage layer: Dexie schema, repositories, cascading delete with blob GC, quota handling

## Summary

Implement the persistence layer of DESIGN §7.2: Dexie database, one repository per
entity, transactional cascade deletes with blob garbage collection, quota-error
routing, and storage persistence request.

## Context

All feature issues read/write through this layer only (UI never touches Dexie). Data
loss and quota exhaustion are top product risks (DESIGN §13, docs/research/03).

## Scope

`src/storage/`: `db.ts`, `repos/{blobs,drawings,characters,books,pages,settings}.ts`,
`gc.ts`, `quota.ts`, unit tests with `fake-indexeddb`.

## Detailed Requirements

1. Dexie db `inkstory` version 1, stores exactly as DESIGN §7.2 (indexes included).
2. Every record is validated with the issue-04 schema on **read** (`parseOrThrow`) and
   on **write**; corrupt rows surface as a typed `StorageCorruptionError` (UI copy later).
3. Repositories expose typed CRUD + queries used by the app:
   `charactersRepo.listByRecency()`, `pagesRepo.listByBook(bookId)` (ordered by
   `Book.pageOrder`), `settingsRepo.get/set`.
4. Blob API: `blobsRepo.put(mime, blob) → id` computes and stores `size`;
   `blobsRepo.getUrl(id)` returns an object-URL with a documented release helper.
5. Cascade delete in one Dexie transaction (DESIGN §7.2):
   - deleteCharacter: character + its drawing + texture/thumb blobs, **blocked with a
     typed error listing book titles if any page references the character** (UI decides).
   - deleteBook: book + its pages + narration blobs.
   - `gc.sweep()` deletes blobs referenced by no row (used after imports/crashes;
     reference scan inside the same transaction).
6. `quota.ts`: wrap every write; on `QuotaExceededError` emit a single app event
   consumed by a global "storage full" dialog (dialog itself in issue 23 scope — here,
   the event + a console fallback). `requestPersistence()` calls
   `navigator.storage.persist()` once after the first successful character save and
   records the result in settings; `getUsage()` wraps `estimate()`.
7. Migration pattern documented in `db.ts` header comment: additive Dexie `version(n)`
   with upgrade functions; schemaVersion fields never mutated in place.

## Acceptance Criteria

- Unit tests (fake-indexeddb): CRUD round-trips for every repo with schema validation;
  cascade delete removes exactly the specified rows/blobs and nothing else;
  deleteCharacter blocks when referenced; `gc.sweep()` removes an orphaned blob and
  keeps referenced ones.
- Simulated `QuotaExceededError` (mock) triggers exactly one storage-full event and the
  failed write rolls back (no partial rows).
- A row hand-corrupted in the test (extra field) raises `StorageCorruptionError` on read.

## Validation

`pnpm test src/storage` green; coverage of `gc.ts` and cascade paths ≥90% lines.

## Dependencies

04.

## Non-goals

Export/import (22), storage UI (23), settings screen wiring (03 already stubbed).

## Design References

DESIGN.md §7.1, §7.2, §10.3 (B4 rows), §13; docs/research/03; ADR-005.
