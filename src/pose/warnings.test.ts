import { expect, it } from 'vitest';
import { templateJoints } from './template';
import { jointWarnings } from './warnings';
it('reports outside-mask and crossed limbs without altering the draft', () => {
  const joints = templateJoints({ x: 0, y: 0, width: 100, height: 100 });
  const mask = new Uint8Array(10000).fill(255);
  expect(jointWarnings(joints, mask, 100, 100)).toEqual([]);
  const changed = {
    ...joints,
    right_hand: { x: 80, y: 50 },
    left_foot: { x: 100, y: 110 },
  };
  expect(jointWarnings(changed, mask, 100, 100)).toEqual(
    expect.arrayContaining([
      { joint: 'right_hand', reason: 'crossed' },
      { joint: 'left_foot', reason: 'outside' },
    ]),
  );
  expect(changed.left_foot).toEqual({ x: 100, y: 110 });
});
