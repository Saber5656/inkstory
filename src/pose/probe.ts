export type ExecutionProvider = 'webgpu' | 'wasm';
export interface PoseCapabilities { webgpu: boolean; crossOriginIsolated: boolean; hardwareConcurrency: number; }
export interface PoseProbe { executionProvider: ExecutionProvider; numThreads: number; }

export function detectCapabilities(): PoseCapabilities {
  return { webgpu: typeof navigator !== 'undefined' && 'gpu' in navigator, crossOriginIsolated: typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated, hardwareConcurrency: typeof navigator === 'undefined' ? 1 : navigator.hardwareConcurrency || 1 };
}
export function selectExecutionProvider(capabilities: PoseCapabilities): PoseProbe {
  const cpu = Math.max(1, capabilities.hardwareConcurrency - 1);
  return { executionProvider: capabilities.webgpu ? 'webgpu' : 'wasm', numThreads: capabilities.crossOriginIsolated ? Math.min(4, cpu) : 1 };
}
