import { describe, expect, it } from 'vitest';
import { applyBrush, MaskHistory } from './mask.ts';
import { segment } from './segment.ts';

function image(
  width: number,
  height: number,
  draw: (x: number, y: number) => [number, number, number],
) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = draw(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  return { width, height, data };
}

describe('vision pure operations', () => {
  it('finds the largest dark component on a white image', () => {
    const source = image(128, 96, (x, y) =>
      x > 32 && x < 96 && y > 20 && y < 76 ? [20, 20, 20] : [255, 255, 255],
    );
    const result = segment(source);
    expect(result.ok).toBe(true);
    expect(result.coverage).toBeGreaterThan(0.2);
    expect(result.coverage).toBeLessThan(0.7);
    expect(result.mask[48 * 128 + 64]).toBe(255);
    expect(result.mask[0]).toBe(0);
  });

  it('supports brush changes and exact undo/redo', () => {
    const empty = new Uint8Array(25);
    const changed = applyBrush(empty, 5, 5, {
      x: 2,
      y: 2,
      radius: 1,
      mode: 'add',
    });
    expect(changed[12]).toBe(255);
    const history = new MaskHistory();
    history.push(empty);
    expect(history.undo(changed)).toEqual(empty);
    expect(history.redo(empty)).toEqual(changed);
  });

  it('marks blank and fully dark inputs as uncertain', () => {
    const white = image(64, 64, () => [255, 255, 255]);
    const dark = image(64, 64, () => [0, 0, 0]);
    expect(segment(white).ok).toBe(false);
    expect(segment(dark).ok).toBe(false);
  });

  it('covers six deterministic drawing fixture families with plausible masks', () => {
    const fixtures = [
      (x: number, y: number) => x > 24 && x < 104 && y > 16 && y < 112,
      (x: number, y: number) => Math.hypot(x - 64, y - 64) < 45,
      (x: number, y: number) =>
        y > 20 && y < 108 && Math.abs(x - 64) < (y - 16) / 2,
      (x: number, y: number) =>
        (x > 35 && x < 93 && y > 20 && y < 108) ||
        (x > 20 && x < 108 && y > 52 && y < 76),
      (x: number, y: number) => Math.abs(x - 64) < 12 || Math.abs(y - 64) < 12,
      (x: number, y: number) => Math.abs(x - 64) + Math.abs(y - 64) < 48,
    ];
    for (const shape of fixtures) {
      const source = image(128, 128, (x, y) =>
        shape(x, y) ? [30, 30, 30] : [255, 255, 255],
      );
      const result = segment(source);
      expect(result.ok).toBe(true);
      expect(result.coverage).toBeGreaterThan(0.02);
      expect(result.coverage).toBeLessThan(0.98);
    }
  });
});
