import manifestJson from './modelManifest.generated.json';
import type { ExecutionProvider } from './probe.ts';

export type PoseUnavailableReason =
  'unavailable' | 'manifest' | 'fetch' | 'integrity' | 'session' | 'inference';
export interface ModelManifest {
  id: string;
  status: 'available' | 'unavailable';
  file: string;
  sha256: string;
  sizeBytes: number;
  inputWidth: number;
  inputHeight: number;
  normalization: {
    mean: [number, number, number];
    std: [number, number, number];
  };
  outputSpec: 'coco17-heatmaps';
  license: string;
  provenance: Record<string, string>;
  unavailableReason?: string;
  /** ORT's wasm binary is supplied as verified bytes before a wasm session is created. */
  wasm?: RuntimeAssetManifest;
}
export interface RuntimeAssetManifest {
  file: string;
  sha256: string;
  sizeBytes: number;
}
export interface LoadedRuntimeAsset {
  bytes: ArrayBuffer;
  manifest: RuntimeAssetManifest;
}
export interface LoadedModel {
  available: true;
  bytes: ArrayBuffer;
  manifest: ModelManifest;
  wasm?: LoadedRuntimeAsset;
}
export interface UnavailableModel {
  available: false;
  reason: PoseUnavailableReason;
  detail?: string;
}
export type ModelLoadResult = LoadedModel | UnavailableModel;
export interface ModelLoaderOptions {
  fetch?: typeof globalThis.fetch;
  cacheStorage?: CacheStorage;
  crypto?: Crypto;
  onProgress?: (loaded: number, total?: number) => void;
  manifest?: unknown;
}

const CACHE_NAME = 'models-v1';
export const reviewedPoseManifest = manifestJson as unknown as ModelManifest;

/** True only for the manifest imported into this reviewed app bundle. */
export function isReviewedPoseManifest(value: unknown): value is ModelManifest {
  return value === reviewedPoseManifest && parseManifest(value) !== null;
}

export async function loadPoseModel(
  options: ModelLoaderOptions = {},
): Promise<ModelLoadResult> {
  const manifest = parseManifest(options.manifest ?? reviewedPoseManifest);
  if (!manifest) return { available: false, reason: 'manifest' };
  if (manifest.status === 'unavailable')
    return {
      available: false,
      reason: 'unavailable',
      detail: manifest.unavailableReason,
    };
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const cache =
    options.cacheStorage ??
    (typeof caches === 'undefined' ? undefined : caches);
  const url = `/models/${encodeURIComponent(manifest.file)}`;
  const model = await loadVerifiedAsset(
    url,
    {
      file: manifest.file,
      sha256: manifest.sha256,
      sizeBytes: manifest.sizeBytes,
    },
    fetcher,
    cache,
    options,
  );
  if (!model.ok)
    return { available: false, reason: model.reason, detail: model.detail };
  let wasm: LoadedRuntimeAsset | undefined;
  if (manifest.wasm) {
    const wasmUrl = `/models/${encodeURIComponent(manifest.wasm.file)}`;
    const verifiedWasm = await loadVerifiedAsset(
      wasmUrl,
      manifest.wasm,
      fetcher,
      cache,
      options,
    );
    if (!verifiedWasm.ok)
      return {
        available: false,
        reason: verifiedWasm.reason,
        detail: `ORT wasm: ${verifiedWasm.detail ?? verifiedWasm.reason}`,
      };
    wasm = { bytes: verifiedWasm.bytes, manifest: manifest.wasm };
  }
  return { available: true, bytes: model.bytes, manifest, wasm };
}

function parseManifest(value: unknown): ModelManifest | null {
  if (!value || typeof value !== 'object') return null;
  const manifest = value as Partial<ModelManifest>;
  if (
    (manifest.status !== 'available' && manifest.status !== 'unavailable') ||
    typeof manifest.file !== 'string' ||
    typeof manifest.id !== 'string'
  )
    return null;
  if (manifest.status === 'unavailable') return value as ModelManifest;
  const sizeBytes = manifest.sizeBytes;
  const inputWidth = manifest.inputWidth;
  const inputHeight = manifest.inputHeight;
  if (
    !/^[a-f0-9]{64}$/i.test(manifest.sha256 ?? '') ||
    typeof sizeBytes !== 'number' ||
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes <= 0 ||
    !manifest.normalization
  )
    return null;
  if (
    typeof inputWidth !== 'number' ||
    typeof inputHeight !== 'number' ||
    !Number.isSafeInteger(inputWidth) ||
    !Number.isSafeInteger(inputHeight) ||
    inputWidth <= 0 ||
    inputHeight <= 0
  )
    return null;
  if (
    manifest.outputSpec !== 'coco17-heatmaps' ||
    typeof manifest.license !== 'string' ||
    manifest.license.length === 0 ||
    !manifest.provenance ||
    typeof manifest.provenance !== 'object'
  )
    return null;
  const normalization = manifest.normalization;
  if (
    !Array.isArray(normalization.mean) ||
    normalization.mean.length !== 3 ||
    !Array.isArray(normalization.std) ||
    normalization.std.length !== 3 ||
    normalization.std.some((value) => !Number.isFinite(value) || value === 0) ||
    normalization.mean.some((value) => !Number.isFinite(value))
  )
    return null;
  if (manifest.wasm && !isRuntimeAssetManifest(manifest.wasm)) return null;
  return value as ModelManifest;
}

function isRuntimeAssetManifest(value: unknown): value is RuntimeAssetManifest {
  if (!value || typeof value !== 'object') return false;
  const asset = value as Partial<RuntimeAssetManifest>;
  const sizeBytes = asset.sizeBytes;
  return (
    typeof asset.file === 'string' &&
    asset.file.length > 0 &&
    /^[a-f0-9]{64}$/i.test(asset.sha256 ?? '') &&
    typeof sizeBytes === 'number' &&
    Number.isSafeInteger(sizeBytes) &&
    sizeBytes > 0
  );
}

type VerifiedAssetResult =
  | { ok: true; bytes: ArrayBuffer }
  | { ok: false; reason: 'fetch' | 'integrity'; detail?: string };

async function loadVerifiedAsset(
  url: string,
  asset: RuntimeAssetManifest,
  fetcher: typeof globalThis.fetch,
  cache: CacheStorage | undefined,
  options: ModelLoaderOptions,
): Promise<VerifiedAssetResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (cache) {
      try {
        const bucket = await cache.open(CACHE_NAME);
        const stored = await bucket.match(url);
        if (stored) {
          const bytes = await stored.arrayBuffer();
          if (
            await verifyAssetIntegrity(
              bytes,
              asset.sha256,
              options.crypto,
              asset.sizeBytes,
            )
          )
            return { ok: true, bytes };
          await bucket.delete(url);
        }
      } catch {
        /* a cache failure falls through to the network */
      }
    }
    let response: Response;
    try {
      response = await fetcher(url);
    } catch (error) {
      return {
        ok: false,
        reason: 'fetch',
        detail: error instanceof Error ? error.message : undefined,
      };
    }
    if (!response.ok)
      return { ok: false, reason: 'fetch', detail: `HTTP ${response.status}` };
    let bytes: ArrayBuffer;
    try {
      bytes = await readResponse(response, options.onProgress);
    } catch (error) {
      return {
        ok: false,
        reason: 'fetch',
        detail: error instanceof Error ? error.message : undefined,
      };
    }
    if (
      !(await verifyAssetIntegrity(
        bytes,
        asset.sha256,
        options.crypto,
        asset.sizeBytes,
      ))
    ) {
      if (cache)
        await cache.open(CACHE_NAME).then((bucket) => bucket.delete(url));
      if (attempt === 1) return { ok: false, reason: 'integrity' };
      continue;
    }
    if (cache)
      try {
        await cache
          .open(CACHE_NAME)
          .then((bucket) => bucket.put(url, new Response(bytes.slice(0))));
      } catch {
        /* cache is an optimization */
      }
    return { ok: true, bytes };
  }
  return { ok: false, reason: 'integrity' };
}

async function readResponse(
  response: Response,
  onProgress?: ModelLoaderOptions['onProgress'],
): Promise<ArrayBuffer> {
  if (!response.body) {
    const bytes = await response.arrayBuffer();
    onProgress?.(
      bytes.byteLength,
      Number(response.headers.get('content-length') ?? 0) || undefined,
    );
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  const total =
    Number(response.headers.get('content-length') ?? 0) || undefined;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    chunks.push(next.value);
    loaded += next.value.byteLength;
    onProgress?.(loaded, total);
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

export async function verifyAssetIntegrity(
  bytes: ArrayBuffer,
  expected: string,
  cryptoObject = globalThis.crypto,
  expectedSize?: number,
): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/i.test(expected) || !cryptoObject?.subtle) return false;
  if (expectedSize !== undefined && bytes.byteLength !== expectedSize)
    return false;
  try {
    const digest = await cryptoObject.subtle.digest('SHA-256', bytes);
    const actual = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    return actual === expected.toLowerCase();
  } catch {
    return false;
  }
}

export function providerSessionOptions(
  provider: ExecutionProvider,
  numThreads: number,
): { executionProviders: string[]; intraOpNumThreads?: number } {
  return provider === 'webgpu'
    ? { executionProviders: ['webgpu'] }
    : { executionProviders: ['wasm'], intraOpNumThreads: numThreads };
}
