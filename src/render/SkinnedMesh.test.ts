import { describe, expect, it } from 'vitest';
import { uvsForVertices } from './SkinnedMesh';

describe('skinned mesh texture coordinates', () => {
  it('maps normalized mesh extents to the full texture', () => {
    expect(uvsForVertices([-1, -1, 1, -1, 1, 1, -1, 1])).toEqual([0, 0, 1, 0, 1, 1, 0, 1]);
  });
});
