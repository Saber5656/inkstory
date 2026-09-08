# Exchange hostile-input corpus

The exchange tests generate these cases with `fflate` so the bytes remain small and
repeatable: path traversal, unknown entry, nested archive, compression-ratio overflow,
entry/total size overflow, oversized PNG dimensions, NaN rig JSON, strict-schema extra
keys, dangling audio, unsafe or spoofed audio MIME, and unsupported `formatVersion`.
Each case is passed through `prepareImport()` and asserts that the database row count is
unchanged. Binary fixtures are intentionally generated in the test to avoid storing
large or opaque archives in the repository.
