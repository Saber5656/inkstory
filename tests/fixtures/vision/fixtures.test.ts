import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildRig } from '../../../src/rig/buildRig.ts';
import { templateJoints } from '../../../src/pose/template.ts';
import { segment } from '../../../src/vision/segment.ts';
import { decodeRgbaPng, fixturePath } from './png.ts';

const ids = [
  'humanoid-pencil-faint',
  'humanoid-colored',
  'humanoid-shadow',
  'humanoid-nonideal',
  'nonhumanoid-cat',
  'nonhumanoid-rocket',
] as const;
const humanoids = ids.slice(0, 4);
function maskFromPng(path: string) {
  const png = decodeRgbaPng(path);
  return {
    width: png.width,
    height: png.height,
    mask: Uint8Array.from(
      { length: png.width * png.height },
      (_, i) => png.data[i * 4] ?? 0,
    ),
  };
}
function iou(a: Uint8Array, b: Uint8Array): number {
  let intersection = 0,
    union = 0;
  for (let i = 0; i < a.length; i += 1) {
    const aa = a[i] !== 0,
      bb = b[i] !== 0;
    if (aa && bb) intersection += 1;
    if (aa || bb) union += 1;
  }
  return union ? intersection / union : 1;
}
function sourceAndGolden(id: string) {
  const source = decodeRgbaPng(fixturePath(id));
  const golden = maskFromPng(fixturePath(id, true));
  expect(source.width).toBe(golden.width);
  expect(source.height).toBe(golden.height);
  return { source, golden };
}

describe('project-created vision fixtures', () => {
  it.each(ids)('%s has a decodable source and annotated golden mask', (id) => {
    const { source, golden } = sourceAndGolden(id);
    expect(source.data.length).toBe(source.width * source.height * 4);
    expect(golden.mask.some((value) => value !== 0)).toBe(true);
    expect(golden.mask.some((value) => value === 0)).toBe(true);
  });
  it.each(humanoids)('%s segmentation overlaps the golden mask', (id) => {
    const { source, golden } = sourceAndGolden(id);
    const result = segment(source);
    const score = iou(result.mask, golden.mask);
    expect(result.ok).toBe(true);
    expect(score, `${id} IoU=${score.toFixed(3)}`).toBeGreaterThanOrEqual(0.9);
  });
  it.each(ids.slice(4))(
    '%s segmentation remains plausible for non-humanoid art',
    (id) => {
      const { source, golden } = sourceAndGolden(id);
      const result = segment(source);
      expect(result.ok).toBe(true);
      const score = iou(result.mask, golden.mask);
      expect(score).toBeGreaterThanOrEqual(0.6);
    },
  );
  it('keeps all-white and full scribble failure rules', () => {
    const data = new Uint8Array(64 * 64 * 4);
    data.fill(255);
    expect(segment({ width: 64, height: 64, data }).ok).toBe(false);
    const scribble = new Uint8Array(64 * 64 * 4);
    for (let i = 0; i < scribble.length; i += 4) {
      scribble[i] = 0;
      scribble[i + 1] = 0;
      scribble[i + 2] = 0;
      scribble[i + 3] = 255;
    }
    expect(segment({ width: 64, height: 64, data: scribble }).ok).toBe(false);
  });
});

function goldenRigPath(id: string): string {
  return resolve(process.cwd(), 'tests/fixtures/rigs', `${id}.json`);
}
function rigFor(id: string) {
  const { source, golden } = sourceAndGolden(id);
  const joints = templateJoints({
    x: 0,
    y: 0,
    width: source.width,
    height: source.height,
  });
  return {
    rig: buildRig(golden.mask, source.width, source.height, joints),
    source,
  };
}

describe('rig golden fixture structure and budget', () => {
  it.each(humanoids)('%s has bounded structural output', (id) => {
    const start = performance.now();
    const { rig, source } = rigFor(id);
    const elapsed = performance.now() - start;
    expect(elapsed, `${id} build ${elapsed.toFixed(1)}ms`).toBeLessThan(1000);
    expect(rig.schemaVersion).toBe(1);
    expect(Object.keys(rig.joints)).toHaveLength(16);
    expect(['cdt', 'grid']).toContain(rig.meshMethod);
    expect(rig.textureSize).toEqual([160, 192]);
    const vertices = rig.mesh.vertices.length / 2;
    expect(vertices).toBeLessThanOrEqual(3000);
    expect(rig.mesh.triangles.length % 3).toBe(0);
    expect(
      rig.mesh.triangles.every((index) => index >= 0 && index < vertices),
    ).toBe(true);
    expect(rig.weights).toHaveLength(vertices);
    for (const weights of rig.weights) {
      expect(weights.length).toBeGreaterThanOrEqual(1);
      expect(weights.length).toBeLessThanOrEqual(2);
      expect(weights.reduce((sum, entry) => sum + entry.w, 0)).toBeCloseTo(
        1,
        5,
      );
    }
    const path = goldenRigPath(id);
    const sampleVertices = [
      0,
      Math.floor(rig.mesh.vertices.length / 2),
      rig.mesh.vertices.length - 2,
    ];
    const sampleWeights = [
      0,
      Math.floor(rig.weights.length / 2),
      rig.weights.length - 1,
    ];
    if (process.env.UPDATE_FIXTURES === '1') {
      mkdirSync(resolve(process.cwd(), 'tests/fixtures/rigs'), {
        recursive: true,
      });
      writeFileSync(
        path,
        JSON.stringify(
          {
            schemaVersion: rig.schemaVersion,
            meshMethod: rig.meshMethod,
            textureSize: rig.textureSize,
            vertexCount: vertices,
            triangleCount: rig.mesh.triangles.length / 3,
            vertexSamples: sampleVertices.map((index) => ({
              index,
              value: rig.mesh.vertices[index],
            })),
            weightSamples: sampleWeights.map((index) => ({
              index,
              value: rig.weights[index],
            })),
          },
          null,
          2,
        ) + '\n',
      );
    }
    if (existsSync(path) && process.env.UPDATE_FIXTURES !== '1') {
      const expected = JSON.parse(readFileSync(path, 'utf8')) as {
        schemaVersion: number;
        meshMethod: string;
        textureSize: [number, number];
        vertexCount: number;
        triangleCount: number;
        vertexSamples: Array<{ index: number; value: number }>;
        weightSamples: Array<{
          index: number;
          value: Array<{ boneIndex: number; w: number }>;
        }>;
      };
      expect(expected.schemaVersion).toBe(1);
      expect(expected.meshMethod).toBe(rig.meshMethod);
      expect(expected.textureSize).toEqual([source.width, source.height]);
      expect(expected.vertexCount).toBe(vertices);
      expect(expected.triangleCount).toBe(rig.mesh.triangles.length / 3);
      for (const sample of expected.vertexSamples) {
        expect(rig.mesh.vertices[sample.index]).toBeCloseTo(sample.value, 6);
      }
      for (const sample of expected.weightSamples) {
        expect(rig.weights[sample.index]!.length).toBe(sample.value.length);
        for (let j = 0; j < sample.value.length; j += 1) {
          expect(rig.weights[sample.index]![j]!.boneIndex).toBe(
            sample.value[j]!.boneIndex,
          );
          expect(rig.weights[sample.index]![j]!.w).toBeCloseTo(
            sample.value[j]!.w,
            6,
          );
        }
      }
    }
  });
});
