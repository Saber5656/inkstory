import { describe, expect, it } from 'vitest';
import { templateJoints } from '../pose/template.ts';
import { buildRig } from './buildRig.ts';

describe('buildRig', () => {
  it('builds a normalized rig with two or fewer normalized influences', () => {
    const width = 100; const height = 140; const mask = new Uint8Array(width * height);
    for (let y = 10; y < 130; y += 1) for (let x = 30; x < 70; x += 1) mask[y * width + x] = 255;
    const rig = buildRig(mask, width, height, templateJoints({ x: 30, y: 10, width: 40, height: 120 }));
    expect(rig.schemaVersion).toBe(1);
    expect(rig.mesh.vertices.length).toBeGreaterThan(0);
    expect(rig.mesh.triangles.length % 3).toBe(0);
    expect(rig.mesh.vertices.every(Number.isFinite)).toBe(true);
    for (const weights of rig.weights) {
      expect(weights.length).toBeGreaterThanOrEqual(1);
      expect(weights.length).toBeLessThanOrEqual(2);
      expect(weights.reduce((sum, weight) => sum + weight.w, 0)).toBeCloseTo(1);
    }
    expect(rig.joints.root).toEqual({ x: 0, y: 0 });
  });
});
