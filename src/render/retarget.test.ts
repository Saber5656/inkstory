import { describe, expect, it } from 'vitest';
import { BONE_IDS } from '../motion';
import { retargetMotionAngles } from './CharacterActor';

describe('motion retargeting', () => {
  it('preserves clip deltas relative to the character rest pose', () => {
    const clipRest = Object.fromEntries(BONE_IDS.map((bone) => [bone, 90]));
    const characterRest = Object.fromEntries(
      BONE_IDS.map((bone) => [bone, -90]),
    );
    const motion = Object.fromEntries(BONE_IDS.map((bone) => [bone, 120]));
    expect(retargetMotionAngles(clipRest, characterRest, motion).hip).toBe(-60);
  });

  it('uses the shortest arc when clip angles cross ±180 degrees', () => {
    const clipRest = Object.fromEntries(BONE_IDS.map((bone) => [bone, 179]));
    const characterRest = Object.fromEntries(
      BONE_IDS.map((bone) => [bone, -90]),
    );
    const motion = Object.fromEntries(BONE_IDS.map((bone) => [bone, -179]));
    expect(retargetMotionAngles(clipRest, characterRest, motion).hip).toBe(-88);
  });
});
