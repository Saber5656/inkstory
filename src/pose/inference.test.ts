import { describe, expect, it } from 'vitest';
import { decodeHeatmaps, letterbox } from './inference.ts';

describe('pose preprocessing and heatmap decoding', () => {
  it('letterboxes while preserving aspect ratio and CHW normalization', () => {
    const data = new Uint8ClampedArray(4 * 2 * 4); data.fill(100); for (let i = 3; i < data.length; i += 4) data[i] = 255;
    const result = letterbox({ width: 4, height: 2, data }, { inputWidth: 8, inputHeight: 8, normalization: { mean: [0, 0, 0], std: [1, 1, 1] } });
    expect(result.transform.scale).toBe(2);
    expect(result.transform.padY).toBe(2);
    expect(result.tensor[2 * 8 + 2]).toBe(100);
  });

  it('decodes 17 peaks to source coordinates with subpixel refinement', () => {
    const heatmaps = new Float32Array(17 * 8 * 8);
    for (let joint = 0; joint < 17; joint += 1) { const index = joint * 64 + 3 * 8 + 2; heatmaps[index] = 1; heatmaps[index - 1] = 0.8; heatmaps[index + 1] = 0.4; }
    const result = decodeHeatmaps(heatmaps, 8, 8, { scale: 1, padX: 0, padY: 0, sourceWidth: 64, sourceHeight: 64, inputWidth: 64, inputHeight: 64 });
    expect(result).toHaveLength(17);
    expect(result[0]?.x).toBeCloseTo(18, 4);
    expect(result[0]?.y).toBeCloseTo(28, 4);
    expect(result[16]?.name).toBe('right_ankle');
  });
});
