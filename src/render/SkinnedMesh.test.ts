import { describe, expect, it } from 'vitest';
import { Texture } from 'pixi.js';
import { SkinnedMesh, makeMeshIndices, uvsForVertices } from './SkinnedMesh';

describe('skinned mesh texture coordinates', () => {
  it('maps normalized mesh extents to the full texture', () => {
    expect(uvsForVertices([-1, -1, 1, -1, 1, 1, -1, 1])).toEqual([
      0, 0, 1, 0, 1, 1, 0, 1,
    ]);
  });
});

it('keeps immutable rest positions across skin updates', () => {
  const mesh = new SkinnedMesh(
    {
      mesh: { vertices: [1, 2, 3, 4], triangles: [0, 1, 1], uvs: [0, 0, 1, 1] },
      weights: [[{ boneIndex: 0, w: 1 }], [{ boneIndex: 0, w: 1 }]],
    },
    Texture.WHITE,
  );
  const doubled = { a: 2, b: 0, c: 0, d: 2, tx: 0, ty: 0 };
  const identity = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
  mesh.updateSkin([doubled]);
  mesh.updateSkin([identity]);
  expect([...mesh.restVertices]).toEqual([1, 2, 3, 4]);
  expect([...mesh.skinnedVertices]).toEqual([1, 2, 3, 4]);
});

it('uses 16-bit indices for ordinary rigs', () => {
  expect(makeMeshIndices([0, 1, 587])).toBeInstanceOf(Uint16Array);
});

it('keeps 32-bit indices when a rig exceeds the 16-bit range', () => {
  expect(makeMeshIndices([0, 65_536, 1])).toBeInstanceOf(Uint32Array);
});

it('destroys mesh geometry buffers with the mesh', () => {
  const mesh = new SkinnedMesh(
    {
      mesh: { vertices: [0, 0, 1, 0], triangles: [0, 1, 1], uvs: [0, 0, 1, 1] },
      weights: [[{ boneIndex: 0, w: 1 }], [{ boneIndex: 0, w: 1 }]],
    },
    Texture.WHITE,
  );
  const buffers = [...mesh.geometry.buffers];
  mesh.destroy({ children: true });
  expect(buffers.every((buffer) => buffer.destroyed)).toBe(true);
});
