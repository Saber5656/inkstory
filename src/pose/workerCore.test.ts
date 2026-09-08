import { describe, expect, it } from 'vitest';
import { COCO_KEYPOINT_NAMES } from './inference.ts';
import {
  createVerifiedPoseSession,
  runPoseInference,
  type PoseSessionLike,
} from './workerCore.ts';
import type { ModelManifest } from './modelLoader.ts';

const manifest: ModelManifest = {
  id: 'synthetic',
  status: 'available',
  file: 'synthetic.onnx',
  sha256: 'a'.repeat(64),
  sizeBytes: 1,
  inputWidth: 32,
  inputHeight: 32,
  normalization: { mean: [0, 0, 0], std: [1, 1, 1] },
  outputSpec: 'coco17-heatmaps',
  license: 'test',
  provenance: {},
};

describe('pose worker inference core', () => {
  it('verifies wasm before creating a wasm session and falls back in EP order', async () => {
    const wasm = new TextEncoder().encode('wasm').buffer;
    const calls: string[] = [];
    const factory = {
      setWasmBinary: () => {
        calls.push('verify-and-set-wasm');
      },
      create: (
        _model: ArrayBuffer,
        options: { executionProviders: string[] },
      ) => {
        calls.push(`create-${options.executionProviders[0]}`);
        if (options.executionProviders[0] === 'webgpu')
          return Promise.reject(new Error('unsupported'));
        return Promise.resolve({
          inputNames: ['input'],
          outputNames: ['heatmaps'],
          run: () => Promise.resolve({}),
        });
      },
    };
    const result = await createVerifiedPoseSession(
      factory,
      new ArrayBuffer(1),
      'webgpu',
      1,
      {
        bytes: wasm,
        manifest: {
          file: 'ort.wasm',
          sha256:
            '336154bf67f765f8f75d16a0accee61b5ee5f6a75b2a2905703df913bd550f3e',
          sizeBytes: wasm.byteLength,
        },
      },
    );
    expect(result.provider).toBe('wasm');
    expect(calls).toEqual([
      'create-webgpu',
      'verify-and-set-wasm',
      'create-wasm',
    ]);
  });

  it('never creates a wasm session when the runtime bytes are tampered', async () => {
    const calls: string[] = [];
    await expect(
      createVerifiedPoseSession(
        {
          setWasmBinary: () => {
            calls.push('set');
          },
          create: () => {
            calls.push('create');
            return Promise.resolve({} as PoseSessionLike);
          },
        },
        new ArrayBuffer(1),
        'wasm',
        1,
        {
          bytes: new TextEncoder().encode('bad').buffer,
          manifest: {
            file: 'ort.wasm',
            sha256:
              '336154bf67f765f8f75d16a0accee61b5ee5f6a75b2a2905703df913bd550f3e',
            sizeBytes: 4,
          },
        },
      ),
    ).rejects.toThrow('integrity');
    expect(calls).toEqual([]);
  });

  it('runs letterbox, session output, and COCO heatmap decode for all 17 joints', async () => {
    const width = 8;
    const height = 8;
    const heatmaps = new Float32Array(17 * width * height);
    for (let joint = 0; joint < 17; joint += 1)
      heatmaps[
        joint * width * height + ((joint % height) * width + (joint % width))
      ] = 1;
    let tensorCreated = false;
    const session: PoseSessionLike = {
      inputNames: ['input'],
      outputNames: ['heatmaps'],
      run: ({ input }) => {
        tensorCreated = Boolean(input);
        return Promise.resolve({
          heatmaps: { data: heatmaps, dims: [1, 17, height, width] },
        });
      },
    };
    const points = await runPoseInference(
      session,
      { width: 32, height: 32, data: new Uint8ClampedArray(32 * 32 * 4) },
      manifest,
      (data, dims) => ({ data, dims }),
    );
    expect(tensorCreated).toBe(true);
    expect(points).toHaveLength(17);
    expect(points.map((point) => point.name)).toEqual([...COCO_KEYPOINT_NAMES]);
    expect(
      points.every(
        (point) =>
          point.x >= 0 &&
          point.x < 32 &&
          point.y >= 0 &&
          point.y < 32 &&
          point.confidence === 1,
      ),
    ).toBe(true);
  });
});
