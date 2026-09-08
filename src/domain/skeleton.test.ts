import { describe, expect, it } from 'vitest';

import { BONE_IDS, JOINT_NAMES, boneChain } from './skeleton';

describe('fixed humanoid skeleton', () => {
  it('contains the canonical 16 joints and 15 bones in parent-first order', () => {
    expect(JOINT_NAMES).toHaveLength(16);
    expect(BONE_IDS).toHaveLength(15);
    expect(boneChain('root')).toEqual(BONE_IDS);
  });
});
