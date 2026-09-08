import * as ort from 'onnxruntime-web';
import { decodeHeatmaps, letterbox, type ImageDataLike } from './inference.ts';
import { providerSessionOptions, type ModelManifest } from './modelLoader.ts';
import type { PoseProbe } from './probe.ts';

export interface PoseWorkerRequest { id: number; model: ArrayBuffer; manifest: ModelManifest; image: ImageDataLike; probe: PoseProbe; }
export interface PoseWorkerResponse { id: number; keypoints?: ReturnType<typeof decodeHeatmaps>; provider?: string; error?: string; }
let generation = 0;
let session: ort.InferenceSession | undefined;
let loadedModelId = '';

const workerScope = self as unknown as { onmessage: ((event: MessageEvent<PoseWorkerRequest>) => void) | null; postMessage(message: unknown, transfer?: Transferable[]): void };
workerScope.onmessage = (event) => { void handleMessage(event); };
async function handleMessage(event: MessageEvent<PoseWorkerRequest>): Promise<void> {
  const request = event.data; const currentGeneration = ++generation;
  try {
    let provider = request.probe.executionProvider;
    if (!session || loadedModelId !== request.manifest.id) {
      try {
        session = await ort.InferenceSession.create(request.model, providerSessionOptions(provider, request.probe.numThreads));
      } catch (error) {
        if (provider !== 'webgpu') throw error;
        provider = 'wasm';
        session = await ort.InferenceSession.create(request.model, providerSessionOptions('wasm', request.probe.numThreads));
      }
      loadedModelId = request.manifest.id;
    }
    if (currentGeneration !== generation) return;
    const input = letterbox(request.image, request.manifest);
    const inputTensor = new ort.Tensor('float32', input.tensor, [1, 3, request.manifest.inputHeight, request.manifest.inputWidth]);
    const outputs = await session.run({ [session.inputNames[0]!]: inputTensor });
    const output = outputs[session.outputNames[0]!];
    if (!output || !('data' in output) || !Array.isArray(output.dims) || output.dims.length < 3) throw new Error('Pose model output is not a heatmap tensor');
    const dims = output.dims; const heatmapHeight = Number(dims[dims.length - 2]); const heatmapWidth = Number(dims[dims.length - 1]);
    const keypoints = decodeHeatmaps(output.data as Float32Array, heatmapWidth, heatmapHeight, input.transform);
    if (currentGeneration !== generation) return;
    workerScope.postMessage({ id: request.id, keypoints, provider });
  } catch (error) {
    if (currentGeneration !== generation) return;
    workerScope.postMessage({ id: request.id, error: error instanceof Error ? error.message : 'Pose inference failed' });
  }
};
