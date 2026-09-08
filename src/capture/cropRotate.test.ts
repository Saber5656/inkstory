import { describe, expect, it } from 'vitest';
import { clampRect, rotatedDimensions } from './cropRotate.ts';

describe('crop rotation geometry', () => {
  it('exposes exchanged dimensions for quarter turns after cropping', () => {
    const rect = clampRect({ x: 10, y: 5, width: 30, height: 20 }, 100, 100);
    expect(rotatedDimensions(rect.width, rect.height, 90)).toEqual([20, 30]);
  });

  it('clamps crop rectangles to source bounds', () => {
    expect(clampRect({ x: -4, y: 8, width: 20, height: 30 }, 10, 20)).toEqual({ x: 0, y: 8, width: 10, height: 12 });
  });
});
