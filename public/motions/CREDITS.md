# Motion credits and provenance

The ten bundled clips are compact, 2D procedural seed clips created for inkstory from
the fixed 16-joint skeleton. They are not copied BVH recordings and therefore have no
third-party motion-data provenance. This keeps the static MVP redistributable while the
offline BVH converter remains available for contributors.

The converter supports mapping BVH files from the archived
[facebookresearch/AnimatedDrawings](https://github.com/facebookresearch/AnimatedDrawings)
repository. Its [LICENSE](https://github.com/facebookresearch/AnimatedDrawings/blob/main/LICENSE)
is MIT and the repository README states that the code, model weights, and Amateur
Drawings dataset are MIT licensed. The repository was archived on 2025-09-03. The
upstream README does not establish independent redistribution terms for every CMU or
Rokoko source recording, so no such BVH is vendored or claimed as the source of a
bundled clip here. Contributors must record the exact source URL/commit and the source
terms before adding a converted file.

| clip                                                                         | bundled source                    | license conclusion                                                   |
| ---------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------- |
| idle_breathe, wave, walk, run, jump, dance_1, dance_2, spin, sit_down, cheer | inkstory original procedural seed | CC0-equivalent project original; no upstream recording redistributed |
