import { describe, expect, it } from 'vitest';
import { selectExecutionProvider } from './probe.ts';

describe('pose execution provider ladder', () => {
  it('prefers WebGPU and caps isolated wasm threads', () => {
    expect(
      selectExecutionProvider({
        webgpu: true,
        crossOriginIsolated: true,
        hardwareConcurrency: 12,
      }),
    ).toEqual({ executionProvider: 'webgpu', numThreads: 4 });
    expect(
      selectExecutionProvider({
        webgpu: false,
        crossOriginIsolated: false,
        hardwareConcurrency: 12,
      }),
    ).toEqual({ executionProvider: 'wasm', numThreads: 1 });
  });
});
