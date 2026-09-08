# Rig golden fixtures

The four JSON files are serialized outputs for the four humanoid vision annotations:
`humanoid-pencil-faint`, `humanoid-colored`, `humanoid-shadow`, and
`humanoid-nonideal`. They are regenerated with:

```sh
UPDATE_FIXTURES=1 pnpm vitest run tests/fixtures/vision/fixtures.test.ts
```

The test compares schema-shaped fields available in the current branch, mesh and
weight counts, selected numeric samples with tolerance, normalized weights, triangle
bounds, and a one-second build budget. It deliberately does not compare JSON byte
identity, and future UV fields may be added by the parent integration without
changing this fixture contract.
