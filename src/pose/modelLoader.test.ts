import { describe, expect, it, vi } from 'vitest';
import { isReviewedPoseManifest, loadPoseModel, reviewedPoseManifest, verifyAssetIntegrity } from './modelLoader.ts';

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

  it('loads the ORT wasm asset through the same verified cache/fetch path', async () => {
    const model = new TextEncoder().encode('hello');
    const wasm = new TextEncoder().encode('wasm');
    const fetcher = vi.fn((input: URL | RequestInfo) => { const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url; return Promise.resolve(new Response(url.endsWith('ort.wasm') ? wasm : model)); });
    const result = await loadPoseModel({
      manifest: { id: 'pose-v1', status: 'available', file: 'pose.onnx', sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824', sizeBytes: model.length, inputWidth: 8, inputHeight: 8, normalization: { mean: [0, 0, 0], std: [1, 1, 1] }, outputSpec: 'coco17-heatmaps', license: 'MIT', provenance: {}, wasm: { file: 'ort.wasm', sha256: '336154bf67f765f8f75d16a0accee61b5ee5f6a75b2a2905703df913bd550f3e', sizeBytes: wasm.length } },
      fetch: fetcher,
    });
    expect(result.available).toBe(true);
    if (result.available) expect(result.wasm?.bytes.byteLength).toBe(wasm.length);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('retries one integrity mismatch before succeeding', async () => {
    const good = new TextEncoder().encode('hello'); const bad = new TextEncoder().encode('tampered'); let attempts = 0;
    const result = await loadPoseModel({
      manifest: { id: 'pose-v1', status: 'available', file: 'pose.onnx', sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824', sizeBytes: good.length, inputWidth: 8, inputHeight: 8, normalization: { mean: [0, 0, 0], std: [1, 1, 1] }, outputSpec: 'coco17-heatmaps', license: 'MIT', provenance: {} },
      fetch: () => { attempts += 1; const value = attempts === 1 ? bad : good; return Promise.resolve(new Response(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength))); },
    });
    expect(result.available).toBe(true); expect(attempts).toBe(2);
  });

  it('purges a tampered cached model and retries from the network', async () => {
    const good = new TextEncoder().encode('hello');
    const bad = new TextEncoder().encode('tampered');
    let cached: Response | undefined = new Response(bad);
    let deleted = 0;
    let fetched = 0;
    const bucket = {
      match: vi.fn(() => Promise.resolve(cached)),
      delete: vi.fn(() => { deleted += 1; cached = undefined; return Promise.resolve(true); }),
      put: vi.fn((_url: RequestInfo | URL, value: Response) => { cached = value; return Promise.resolve(); }),
    };
    const cacheStorage = { open: vi.fn(() => Promise.resolve(bucket)) } as unknown as CacheStorage;
    const result = await loadPoseModel({
      manifest: { id: 'pose-v1', status: 'available', file: 'pose.onnx', sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824', sizeBytes: good.length, inputWidth: 8, inputHeight: 8, normalization: { mean: [0, 0, 0], std: [1, 1, 1] }, outputSpec: 'coco17-heatmaps', license: 'MIT', provenance: {} },
      cacheStorage,
      fetch: () => { fetched += 1; return Promise.resolve(new Response(good)); },
    });
    expect(result.available).toBe(true);
    expect(deleted).toBe(1);
    expect(fetched).toBe(1);
  });

  it('rejects an available manifest without a complete reviewed asset contract', async () => {
    const result = await loadPoseModel({ manifest: { id: 'pose-v1', status: 'available', file: 'pose.onnx', sha256: '0'.repeat(64), sizeBytes: 1 } });
    expect(result).toEqual({ available: false, reason: 'manifest' });
  });

  it('proves the runtime default is the imported reviewed manifest', () => {
    expect(isReviewedPoseManifest(reviewedPoseManifest)).toBe(true);
    expect(isReviewedPoseManifest({ ...reviewedPoseManifest })).toBe(false);
  });

  it('rejects a mismatched asset hash for model or wasm callers', async () => {
    const bytes = new TextEncoder().encode('wasm-bytes');
    expect(await verifyAssetIntegrity(bytes.buffer, '0000000000000000000000000000000000000000000000000000000000000000')).toBe(false);
  });
});
