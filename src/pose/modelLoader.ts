import manifestJson from './modelManifest.generated.json';
import type { ExecutionProvider } from './probe.ts';

export type PoseUnavailableReason = 'unavailable' | 'manifest' | 'fetch' | 'integrity' | 'session' | 'inference';
export interface ModelManifest {
  id: string; status: 'available' | 'unavailable'; file: string; sha256: string; sizeBytes: number;
  inputWidth: number; inputHeight: number; normalization: { mean: [number, number, number]; std: [number, number, number] };
  outputSpec: 'coco17-heatmaps'; license: string; provenance: Record<string, string>; unavailableReason?: string;
}
export interface LoadedModel { available: true; bytes: ArrayBuffer; manifest: ModelManifest; }
export interface UnavailableModel { available: false; reason: PoseUnavailableReason; detail?: string; }
export type ModelLoadResult = LoadedModel | UnavailableModel;
export interface ModelLoaderOptions { fetch?: typeof globalThis.fetch; cacheStorage?: CacheStorage; crypto?: Crypto; onProgress?: (loaded: number, total?: number) => void; manifest?: unknown; }

const CACHE_NAME = 'models-v1';
export const reviewedPoseManifest = manifestJson as unknown as ModelManifest;

export async function loadPoseModel(options: ModelLoaderOptions = {}): Promise<ModelLoadResult> {
  const manifest = parseManifest(options.manifest ?? reviewedPoseManifest);
  if (!manifest) return { available: false, reason: 'manifest' };
  if (manifest.status === 'unavailable') return { available: false, reason: 'unavailable', detail: manifest.unavailableReason };
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const cache = options.cacheStorage ?? (typeof caches === 'undefined' ? undefined : caches);
  const url = `/models/${encodeURIComponent(manifest.file)}`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (cache) {
      try {
        const stored = await (await cache.open(CACHE_NAME)).match(url);
        if (stored) {
          const bytes = await stored.arrayBuffer();
          if (await verifyHash(bytes, manifest.sha256, options.crypto)) return { available: true, bytes, manifest };
          await cache.open(CACHE_NAME).then((bucket) => bucket.delete(url));
        }
      } catch { /* a cache failure falls through to the network */ }
    }
    let response: Response;
    try { response = await fetcher(url); } catch (error) { return { available: false, reason: 'fetch', detail: error instanceof Error ? error.message : undefined }; }
    if (!response.ok) return { available: false, reason: 'fetch', detail: `HTTP ${response.status}` };
    let bytes: ArrayBuffer;
    try { bytes = await readResponse(response, options.onProgress); } catch (error) { return { available: false, reason: 'fetch', detail: error instanceof Error ? error.message : undefined }; }
    if (!(await verifyHash(bytes, manifest.sha256, options.crypto))) {
      if (cache) await cache.open(CACHE_NAME).then((bucket) => bucket.delete(url));
      if (attempt === 1) return { available: false, reason: 'integrity' };
      continue;
    }
    if (cache) try { await cache.open(CACHE_NAME).then((bucket) => bucket.put(url, new Response(bytes.slice(0)))); } catch { /* cache is an optimization */ }
    return { available: true, bytes, manifest };
  }
  return { available: false, reason: 'integrity' };
}

function parseManifest(value: unknown): ModelManifest | null {
  if (!value || typeof value !== 'object') return null;
  const manifest = value as Partial<ModelManifest>;
  if ((manifest.status !== 'available' && manifest.status !== 'unavailable') || typeof manifest.file !== 'string' || typeof manifest.id !== 'string') return null;
  if (manifest.status === 'unavailable') return value as ModelManifest;
  if (!/^[a-f0-9]{64}$/i.test(manifest.sha256 ?? '') || !Number.isFinite(manifest.sizeBytes) || !manifest.normalization) return null;
  return value as ModelManifest;
}

async function readResponse(response: Response, onProgress?: ModelLoaderOptions['onProgress']): Promise<ArrayBuffer> {
  if (!response.body) { const bytes = await response.arrayBuffer(); onProgress?.(bytes.byteLength, Number(response.headers.get('content-length') ?? 0) || undefined); return bytes; }
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let loaded = 0; const total = Number(response.headers.get('content-length') ?? 0) || undefined;
  while (true) { const next = await reader.read(); if (next.done) break; chunks.push(next.value); loaded += next.value.byteLength; onProgress?.(loaded, total); }
  const bytes = new Uint8Array(loaded); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; } return bytes.buffer;
}

async function verifyHash(bytes: ArrayBuffer, expected: string, cryptoObject = globalThis.crypto): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/i.test(expected) || !cryptoObject?.subtle) return false;
  try { const digest = await cryptoObject.subtle.digest('SHA-256', bytes); const actual = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join(''); return actual === expected.toLowerCase(); } catch { return false; }
}

export function providerSessionOptions(provider: ExecutionProvider, numThreads: number): { executionProviders: string[]; intraOpNumThreads?: number } {
  return provider === 'webgpu' ? { executionProviders: ['webgpu'] } : { executionProviders: ['wasm'], intraOpNumThreads: numThreads };
}
