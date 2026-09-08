import { describe, expect, it } from 'vitest';
import { applyBrush, MaskHistory } from './mask.ts';
import { segment } from './segment.ts';

function image(width: number, height: number, draw: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) { const [r, g, b] = draw(x, y); const i = (y * width + x) * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255; }
  return { width, height, data };
}

describe('vision pure operations', () => {
  it('finds the largest dark component on a white image', () => {
    const source = image(128, 96, (x, y) => x > 32 && x < 96 && y > 20 && y < 76 ? [20, 20, 20] : [255, 255, 255]);
    const result = segment(source);
    expect(result.ok).toBe(true);
    expect(result.coverage).toBeGreaterThan(0.2);
    expect(result.coverage).toBeLessThan(0.7);
    expect(result.mask[48 * 128 + 64]).toBe(255);
    expect(result.mask[0]).toBe(0);
  });

  it('supports brush changes and exact undo/redo', () => {
    const empty = new Uint8Array(25);
    const changed = applyBrush(empty, 5, 5, { x: 2, y: 2, radius: 1, mode: 'add' });
    expect(changed[12]).toBe(255);
    const history = new MaskHistory(); history.push(empty);
    expect(history.undo(changed)).toEqual(empty);
    expect(history.redo(empty)).toEqual(changed);
  });
});
