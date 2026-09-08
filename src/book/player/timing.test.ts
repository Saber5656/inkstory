import { describe, expect, it } from 'vitest';
import { advanceDelay, shouldExit, swipeDirection } from './timing';
describe('kid player timing', () => {
  it('uses silent fallback and waits for narration only in auto mode', () => {
    expect(advanceDelay('tap', false, false)).toBe(null);
    expect(advanceDelay('auto', false, false)).toBe(6000);
    expect(advanceDelay('auto', true, false)).toBe(null);
    expect(advanceDelay('auto', true, true)).toBe(1000);
  });
  it('does not exit on accidental taps and requires deliberate swipes', () => {
    expect(shouldExit(999)).toBe(false);
    expect(shouldExit(1000)).toBe(true);
    expect(swipeDirection(20, 400)).toBe(0);
    expect(swipeDirection(-101, 400)).toBe(1);
    expect(swipeDirection(101, 400)).toBe(-1);
  });
});
