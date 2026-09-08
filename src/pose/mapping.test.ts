import { describe, expect, it } from 'vitest';
import { cocoToSkeleton, meanConfidence } from './mapping.ts';
import { templateJoints } from './template.ts';

describe('pose mapping', () => {
  it('maps COCO landmarks to all 16 joints with derived torso points', () => {
    const keypoints = Array.from({ length: 17 }, (_, index) => ({ x: index * 2, y: index * 3, score: 0.9 }));
    const joints = cocoToSkeleton(keypoints, { width: 100, height: 100 });
    expect(joints.neck).toEqual({ x: 11, y: 16.5 });
    expect(joints.torso).toEqual({ x: 17, y: 25.5 });
    expect(joints.root).toEqual({ x: 23, y: 37.5 });
    expect(Object.keys(joints)).toHaveLength(16);
    expect(meanConfidence(keypoints)).toBeCloseTo(0.9);
  });

  it('uses the fixed template fractions in bbox coordinates', () => {
    const joints = templateJoints({ x: 10, y: 20, width: 200, height: 400 });
    expect(joints.neck).toEqual({ x: 110, y: 92 });
    expect(joints.right_hand).toEqual({ x: 40, y: 220 });
    expect(joints.left_foot).toEqual({ x: 132, y: 392 });
  });
});
