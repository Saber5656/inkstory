# ADR-008: Exact texture UVs and portable Blob persistence

- Date: 2026-09-08
- Status: Accepted for the web MVP implementation

## Texture coordinates

A silhouette's vertex bounds do not include the transparent padding in the texture. Deriving UVs from those bounds stretches the drawing and loses that padding. New rigs store optional `mesh.uvs` as normalized `[0,1]` texture coordinates, with exactly one UV pair per vertex. Strict schema checks reject invalid lengths and non-finite values. Existing version-1 rigs without UVs remain readable using the documented bounds fallback. This additive field does not change the `.inkstory` format version. New imports still use the complete strict rig schema.

Evidence: `src/domain/schema-boundaries.test.ts`, `src/render/SkinnedMesh.test.ts`, `src/rig/buildRig.ts`.

## IndexedDB representation

Playwright WebKit on macOS returned `UnknownError: Error preparing Blob/File data to be stored in object store` when writing a Blob directly. Persist blob bytes as an ArrayBuffer in IndexedDB and reconstruct a validated Blob at the repository boundary. Existing stored Blob rows are still readable, so no destructive migration or database reset is required. Public domain `BlobRecord` and portable bundle DTOs are unchanged. The decoder validates metadata, byte size, and the public schema before returning data. Serialization happens before write transactions so asynchronous Blob reads cannot expire a transaction. Sample creation and narration replacement commit all related rows atomically.

Evidence: `src/storage/blobPersistence.ts`, `src/storage/storage.test.ts`, `src/storage/seed.test.ts`, `tests/e2e/exchange.spec.ts`.

ArrayBuffers increase the memory needed to read large assets. The bundle size limits and worker-based inflation remain mandatory; the large-import measurement is separate from correctness of the stored representation.
