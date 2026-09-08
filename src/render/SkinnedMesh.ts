import { Mesh, MeshGeometry, Texture } from 'pixi.js';
import type { DestroyOptions } from 'pixi.js';
import type { Affine2D } from '../motion/fk';

export type Influence = { boneIndex: number; w: number };
export type SkinRig = {
  mesh: { vertices: number[]; triangles: number[]; uvs?: number[] };
  weights: Influence[][];
  textureSize?: { w: number; h: number } | [number, number];
};

export function makeMeshIndices(
  triangles: readonly number[],
): Uint16Array | Uint32Array {
  const maxIndex = triangles.reduce((max, value) => Math.max(max, value), 0);
  const minIndex = triangles.reduce((min, value) => Math.min(min, value), 0);
  return minIndex >= 0 && maxIndex <= 0xffff
    ? new Uint16Array(triangles)
    : new Uint32Array(triangles);
}

/** Reconstructs UVs for canonical rigs that predate the optional mesh.uvs field. */
export function uvsForVertices(vertices: readonly number[]): number[] {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < vertices.length; index += 2) {
    const x = vertices[index] ?? 0;
    const y = vertices[index + 1] ?? 0;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const width = Math.max(Number.EPSILON, maxX - minX);
  const height = Math.max(Number.EPSILON, maxY - minY);
  const uvs: number[] = [];
  for (let index = 0; index < vertices.length; index += 2) {
    uvs.push(
      ((vertices[index] ?? 0) - minX) / width,
      ((vertices[index + 1] ?? 0) - minY) / height,
    );
  }
  return uvs;
}

export class SkinnedMesh extends Mesh<MeshGeometry> {
  readonly restVertices: Float32Array;
  readonly skinnedVertices: Float32Array;
  readonly influences: Influence[][];

  constructor(rig: SkinRig, texture: Texture) {
    const positions = new Float32Array(rig.mesh.vertices);
    const uvs = new Float32Array(
      rig.mesh.uvs ?? uvsForVertices(rig.mesh.vertices),
    );
    const indices = makeMeshIndices(rig.mesh.triangles);
    // Pixi's v8 declaration narrows indices to Uint32Array, but WebGL supports
    // Uint16Array and it is substantially faster on software/headless renderers.
    const geometry = new MeshGeometry({
      positions,
      uvs,
      indices: indices as Uint32Array,
      shrinkBuffersToFit: false,
    });
    super({ geometry, texture });
    this.restVertices = new Float32Array(positions);
    this.skinnedVertices = new Float32Array(positions.length);
    this.influences = rig.weights;
  }

  override destroy(options?: DestroyOptions): void {
    const geometry = this.geometry;
    super.destroy(options);
    geometry.destroy(true);
  }

  updateSkin(matrices: readonly Affine2D[]): void {
    const source = this.restVertices;
    const target = this.skinnedVertices;
    for (let vertex = 0; vertex < source.length / 2; vertex += 1) {
      const x = source[vertex * 2]!;
      const y = source[vertex * 2 + 1]!;
      let outputX = 0;
      let outputY = 0;
      const influences = this.influences[vertex] ?? [];
      for (let i = 0; i < Math.min(2, influences.length); i += 1) {
        const influence = influences[i]!;
        const matrix = matrices[influence.boneIndex];
        if (!matrix) continue;
        outputX += (matrix.a * x + matrix.c * y + matrix.tx) * influence.w;
        outputY += (matrix.b * x + matrix.d * y + matrix.ty) * influence.w;
      }
      if (influences.length === 0) {
        outputX = x;
        outputY = y;
      }
      target[vertex * 2] = outputX;
      target[vertex * 2 + 1] = outputY;
    }
    const buffer = this.geometry.getBuffer('aPosition');
    const data = buffer.data as Float32Array;
    data.set(target);
    buffer.update();
  }
}
