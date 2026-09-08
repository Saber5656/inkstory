# Exchange hostile-input corpus

The checked-in archives cover path traversal, unknown entry, nested archive,
compression-ratio overflow, entry/total size overflow, oversized PNG dimensions, NaN rig
JSON, strict-schema extra keys, dangling audio, unsafe or spoofed audio MIME, and
unsupported `formatVersion`. Each case is passed through `prepareImport()` and asserts
that every database table is unchanged. Rebuild the deterministic fixtures with:

```sh
node tests/fixtures/bundles/generate-corpus.mjs
```
