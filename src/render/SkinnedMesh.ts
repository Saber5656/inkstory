import { Mesh, MeshGeometry, Texture } from 'pixi.js';
import type { Affine2D } from '../motion/fk';

export type Influence = { boneIndex: number; w: number };
export type SkinRig = { mesh: { vertices: number[]; triangles: number[]; uvs?: number[] }; weights: Influence[][]; textureSize?: { w: number; h: number } | [number, number] };

export class SkinnedMesh extends Mesh<MeshGeometry> {
  readonly restVertices: Float32Array;
  readonly skinnedVertices: Float32Array;
  readonly influences: Influence[][];

  constructor(rig: SkinRig, texture: Texture) {
    const positions = new Float32Array(rig.mesh.vertices);
    const uvs = new Float32Array(rig.mesh.uvs ?? positions.map((_, index) => index % 2));
    const indices = new Uint32Array(rig.mesh.triangles);
    const geometry = new MeshGeometry({ positions, uvs, indices, shrinkBuffersToFit: false });
    super({ geometry, texture });
    this.restVertices = positions;
    this.skinnedVertices = new Float32Array(positions.length);
    this.influences = rig.weights;
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
      if (influences.length === 0) { outputX = x; outputY = y; }
      target[vertex * 2] = outputX;
      target[vertex * 2 + 1] = outputY;
    }
    const buffer = this.geometry.getBuffer('aPosition');
    const data = buffer.data as Float32Array;
    data.set(target);
    buffer.update();
  }
}
