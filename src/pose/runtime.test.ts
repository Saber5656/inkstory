import { describe, expect, it } from 'vitest';
import { estimatePose } from './runtime.ts';

describe('pose runtime fallback', () => {
  it('resolves to unavailable without creating a worker for the reviewed unavailable manifest', async () => {
    const result = await estimatePose({ width: 1, height: 1, close: () => {} });
    expect(result).toMatchObject({ available: false, reason: 'unavailable' });
  });
});
