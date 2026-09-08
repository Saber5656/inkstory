import { describe, expect, it } from 'vitest';
import { forwardKinematics } from './fk';
import { lerpAngle, sampleMotion } from './player';
import type { MotionClip } from './types';

const clip = {
  schemaVersion: 1,
  id: 'test',
  name: { ja: 'テスト', en: 'Test' },
  keywords: { ja: ['てすと'], en: ['test'] },
  category: 'action',
  fps: 1,
  frameCount: 2,
  loop: true,
  rootTranslation: [
    [0, 0],
    [1, 0],
  ],
  restAngles: { right_hand: 0 },
  frames: { right_hand: [170, -170] },
} as unknown as MotionClip;

describe('motion sampling', () => {
  it('interpolates root and angles across the shortest seam', () => {
    expect(lerpAngle(170, -170, 0.5)).toBe(180);
    expect(sampleMotion(clip, 500, 1).rootT).toEqual([0.5, 0]);
    expect(sampleMotion(clip, 500, 1).angles.right_hand).toBe(180);
  });
});

describe('forward kinematics', () => {
  it('preserves character bone length while retargeting angle', () => {
    const rest = {
      root: [0, 0] as [number, number],
      right_hip: [2, 0] as [number, number],
      right_knee: [4, 0] as [number, number],
    };
    const result = forwardKinematics(rest, { right_hip: 90, right_knee: 0 });
    expect(result.joints.right_hip[0]).toBeCloseTo(0);
    expect(result.joints.right_hip[1]).toBeCloseTo(2);
    expect(result.lengths.right_hip).toBe(2);
  });
});
