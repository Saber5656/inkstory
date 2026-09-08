import { describe, expect, it } from 'vitest';
import { convertBvh, parseBvh } from './bvh';

const fixture = `HIERARCHY\nROOT root\n{\n OFFSET 0 0 0\n CHANNELS 6 Xposition Yposition Zposition Xrotation Yrotation Zrotation\n JOINT hand\n {\n  OFFSET 1 0 0\n  CHANNELS 3 Xrotation Yrotation Zrotation\n  End Site\n  {\n   OFFSET 1 0 0\n  }\n }\n}\nMOTION\nFrames: 2\nFrame Time: 0.5\n0 0 0 0 0 0 0 0 0\n0 0 0 0 0 0 90 0 0`;

describe('BVH motion pipeline', () => {
  it('parses a synthetic hierarchy and converts projected angles', () => {
    expect(parseBvh(fixture).frameCount).toBe(2);
    const clip = convertBvh(fixture, { id: 'fixture', name: { ja: 'テスト', en: 'Fixture' }, keywords: { ja: ['てすと'], en: ['test'] }, category: 'action', jointMap: { root: 'root', hip: 'root', torso: 'root', neck: 'root', right_shoulder: 'root', right_elbow: 'root', right_hand: 'hand', left_shoulder: 'root', left_elbow: 'root', left_hand: 'root', right_hip: 'root', right_knee: 'root', right_foot: 'root', left_hip: 'root', left_knee: 'root', left_foot: 'root' }, fps: 2, loop: false });
    expect(clip.schemaVersion).toBe(1);
    expect(clip.frames.right_hand[1]).toBeCloseTo(90);
  });
});
