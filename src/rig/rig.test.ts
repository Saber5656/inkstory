import { describe, expect, it } from 'vitest';
import { templateJoints } from '../pose/template.ts';
import { buildRig } from './buildRig.ts';

describe('buildRig', () => {
  it('builds a normalized rig with two or fewer normalized influences', () => {
    const width = 100;
    const height = 140;
    const mask = new Uint8Array(width * height);
    for (let y = 10; y < 130; y += 1)
      for (let x = 30; x < 70; x += 1) mask[y * width + x] = 255;
    const rig = buildRig(
      mask,
      width,
      height,
      templateJoints({ x: 30, y: 10, width: 40, height: 120 }),
    );
    expect(rig.schemaVersion).toBe(1);
    expect(rig.mesh.vertices.length).toBeGreaterThan(0);
    expect(rig.mesh.triangles.length % 3).toBe(0);
    expect(
      rig.mesh.triangles.every(
        (index) => index >= 0 && index < rig.mesh.vertices.length / 2,
      ),
    ).toBe(true);
    expect(rig.mesh.vertices.every(Number.isFinite)).toBe(true);
    for (const weights of rig.weights) {
      expect(weights.length).toBeGreaterThanOrEqual(1);
      expect(weights.length).toBeLessThanOrEqual(2);
      expect(weights.reduce((sum, weight) => sum + weight.w, 0)).toBeCloseTo(1);
    }
    expect(rig.joints.root).toEqual([0, 0]);
    expect(rig.textureSize).toEqual([width, height]);
  });

  it('falls back to a usable grid result for a degenerate thin mask', () => {
    const mask = new Uint8Array(32 * 32);
    for (let x = 2; x < 30; x += 1) mask[16 * 32 + x] = 255;
    const rig = buildRig(
      mask,
      32,
      32,
      templateJoints({ x: 2, y: 8, width: 28, height: 16 }),
    );
    expect(rig.meshMethod).toBe('grid');
    expect(rig.mesh.triangles.length % 3).toBe(0);
    expect(
      rig.mesh.triangles.every((index) => index < rig.mesh.vertices.length / 2),
    ).toBe(true);
  });
});
