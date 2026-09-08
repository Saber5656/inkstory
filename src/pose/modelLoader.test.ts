import { describe, expect, it, vi } from 'vitest';
import { loadPoseModel } from './modelLoader.ts';

describe('reviewed pose model loader', () => {
  it('does not fetch when the bundled manifest is unavailable', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const result = await loadPoseModel({ manifest: { id: 'pose-v1', status: 'unavailable', file: 'pose-v1.onnx', unavailableReason: 'blocked' }, fetch: fetcher });
    expect(result).toEqual({ available: false, reason: 'unavailable', detail: 'blocked' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('verifies a reviewed SHA-256 before returning bytes', async () => {
    const bytes = new TextEncoder().encode('hello');
    const result = await loadPoseModel({
      manifest: { id: 'pose-v1', status: 'available', file: 'pose.onnx', sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824', sizeBytes: bytes.length, inputWidth: 8, inputHeight: 8, normalization: { mean: [0, 0, 0], std: [1, 1, 1] }, outputSpec: 'coco17-heatmaps', license: 'MIT', provenance: {} },
      fetch: () => Promise.resolve(new Response(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))),
    });
    expect(result.available).toBe(true);
    if (result.available) {
      expect(result.bytes.byteLength).toBe(bytes.byteLength);
      expect(Array.from(new Uint8Array(result.bytes))).toEqual(Array.from(bytes));
    }
  });

  it('retries one integrity mismatch before succeeding', async () => {
    const good = new TextEncoder().encode('hello'); const bad = new TextEncoder().encode('tampered'); let attempts = 0;
    const result = await loadPoseModel({
      manifest: { id: 'pose-v1', status: 'available', file: 'pose.onnx', sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824', sizeBytes: good.length, inputWidth: 8, inputHeight: 8, normalization: { mean: [0, 0, 0], std: [1, 1, 1] }, outputSpec: 'coco17-heatmaps', license: 'MIT', provenance: {} },
      fetch: () => { attempts += 1; const value = attempts === 1 ? bad : good; return Promise.resolve(new Response(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength))); },
    });
    expect(result.available).toBe(true); expect(attempts).toBe(2);
  });
});
