# Motion pipeline

The TypeScript converter turns a BVH string into a schema-validated motion clip. Its
synthetic acceptance fixture is run with:

```sh
pnpm exec vitest run src/motion/bvhPipeline.test.ts
```

The checked-in MVP library intentionally uses original procedural seed clips. To
reproduce those ten files and rebuild their catalog hashes, run the tools-side command
(the root package may expose it as `motion:convert:all`):

```sh
node tools/motion-pipeline/convert-all.mjs
```

`--source <dir> --out <dir>` regenerates into a separate directory. The command reads
all ten inputs before writing, emits stable compact JSON with one trailing newline,
rebuilds `index.json`, and rejects missing bones, angle clamp violations, or loop seams
over four degrees. It has no runtime dependency and runs with Node 20.

The command does not claim that the procedural seeds were converted from upstream BVH.
The archived AnimatedDrawings repository and its MIT code are useful references for the
converter, but its README does not provide independent redistribution terms for every
CMU or Rokoko recording. No such BVH is vendored; the reason and audit scope are
recorded in `public/motions/CREDITS.md` and ADR-006. A contributor adding a BVH must
record its exact source commit and terms before using the converter.
