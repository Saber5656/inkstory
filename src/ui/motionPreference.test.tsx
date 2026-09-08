import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useMotionPreference, setMotionPreference } from './motionPreference';
it('shares a persisted override across mounted screens and restores system mode', async () => {
  const a = renderHook(useMotionPreference),
    b = renderHook(useMotionPreference);
  expect(a.result.current).toBeUndefined();
  await act(() => setMotionPreference(true));
  expect(a.result.current).toBe(true);
  expect(b.result.current).toBe(true);
  expect(localStorage.getItem('inkstory.reducedMotion')).toBe('true');
  await act(() => setMotionPreference(false));
  expect(a.result.current).toBe(false);
  await act(() => setMotionPreference(undefined));
  expect(a.result.current).toBeUndefined();
});
