import { describe, expect, it, vi } from 'vitest';
import {
  capMotionSpeed,
  getSystemReducedMotion,
  resolveReducedMotion,
  subscribeReducedMotion,
} from './reducedMotion';

describe('reduced motion preference', () => {
  it('caps skeletal motion speed at one when reduced motion is active', () => {
    expect(capMotionSpeed(2, true)).toBe(1);
    expect(capMotionSpeed(0.5, true)).toBe(0.5);
    expect(capMotionSpeed(2, false)).toBe(2);
  });

  it('uses an explicit override and otherwise the system preference', () => {
    expect(resolveReducedMotion(undefined, true)).toBe(true);
    expect(resolveReducedMotion(undefined, false)).toBe(false);
    expect(resolveReducedMotion(true, false)).toBe(true);
    expect(resolveReducedMotion(false, true)).toBe(false);
  });

  it('reads and subscribes to the system media query', () => {
    const query = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(query));
    expect(getSystemReducedMotion()).toBe(true);
    const listener = vi.fn();
    const unsubscribe = subscribeReducedMotion(listener);
    expect(listener).toHaveBeenCalledWith(true);
    expect(query.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
    const callback = query.addEventListener.mock.calls[0]?.[1] as
      ((event: MediaQueryListEvent) => void) | undefined;
    callback?.({ matches: false } as MediaQueryListEvent);
    expect(listener).toHaveBeenLastCalledWith(false);
    unsubscribe();
    expect(query.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
    vi.unstubAllGlobals();
  });
});
