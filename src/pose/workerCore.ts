import {
  decodeHeatmaps,
  letterbox,
  type DecodedKeypoint,
  type ImageDataLike,
} from './inference.ts';
import {
  providerSessionOptions,
  verifyAssetIntegrity,
  type ModelManifest,
  type RuntimeAssetManifest,
} from './modelLoader.ts';
import type { ExecutionProvider } from './probe.ts';

export interface PoseTensorLike {
  readonly data: unknown;
  readonly dims: readonly number[];
}
export interface PoseSessionLike {
  readonly inputNames: readonly string[];
  readonly outputNames: readonly string[];
  run(inputs: Record<string, unknown>): Promise<Record<string, PoseTensorLike>>;
}

export interface PoseSessionFactory {
  create(
    model: ArrayBuffer,
    options: { executionProviders: string[]; intraOpNumThreads?: number },
  ): Promise<PoseSessionLike>;
  setWasmBinary(bytes: ArrayBuffer): void;
}

/** Verifies wasm immediately before any wasm EP session creation. */
export async function createVerifiedPoseSession(
  factory: PoseSessionFactory,
  model: ArrayBuffer,
  provider: ExecutionProvider,
  numThreads: number,
  wasm: { bytes: ArrayBuffer; manifest: RuntimeAssetManifest } | undefined,
): Promise<{ session: PoseSessionLike; provider: ExecutionProvider }> {
  const createWasm = async (): Promise<PoseSessionLike> => {
    if (
      !wasm ||
      wasm.bytes.byteLength !== wasm.manifest.sizeBytes ||
      !(await verifyAssetIntegrity(
        wasm.bytes,
        wasm.manifest.sha256,
        undefined,
        wasm.manifest.sizeBytes,
      ))
    )
      throw new Error('ORT wasm integrity verification failed');
    factory.setWasmBinary(wasm.bytes);
    return factory.create(model, providerSessionOptions('wasm', numThreads));
  };
  if (provider === 'wasm') return { session: await createWasm(), provider };
  try {
    return {
      session: await factory.create(
        model,
        providerSessionOptions('webgpu', numThreads),
      ),
      provider,
    };
  } catch {
    return { session: await createWasm(), provider: 'wasm' };
  }
}

/** Runs one worker inference with injectable Tensor construction for deterministic tests. */
export async function runPoseInference(
  session: PoseSessionLike,
  image: ImageDataLike,
  manifest: ModelManifest,
  createTensor: (data: Float32Array, dims: readonly number[]) => unknown,
): Promise<DecodedKeypoint[]> {
  const input = letterbox(image, manifest);
  const inputTensor = createTensor(input.tensor, [
    1,
    3,
    manifest.inputHeight,
    manifest.inputWidth,
  ]);
  const inputName = session.inputNames[0];
  const outputName = session.outputNames[0];
  if (!inputName || !outputName)
    throw new Error('Pose model has no input/output tensor');
  const outputs = await session.run({ [inputName]: inputTensor });
  const output = outputs[outputName];
  if (
    !output ||
    !('data' in output) ||
    !Array.isArray(output.dims) ||
    output.dims.length < 3
  )
    throw new Error('Pose model output is not a heatmap tensor');
  const heatmapHeight = Number(output.dims[output.dims.length - 2]);
  const heatmapWidth = Number(output.dims[output.dims.length - 1]);
  if (
    !Number.isSafeInteger(heatmapWidth) ||
    !Number.isSafeInteger(heatmapHeight) ||
    heatmapWidth <= 0 ||
    heatmapHeight <= 0
  )
    throw new Error('Pose model output has invalid heatmap dimensions');
  if (!(output.data instanceof Float32Array) && !Array.isArray(output.data))
    throw new Error('Pose model output has invalid heatmap data');
  return decodeHeatmaps(
    output.data,
    heatmapWidth,
    heatmapHeight,
    input.transform,
  );
}
