import * as ort from 'onnxruntime-web';
import type { ImageDataLike } from './inference.ts';
import type { ModelManifest, RuntimeAssetManifest } from './modelLoader.ts';
import type { PoseProbe } from './probe.ts';
import { createVerifiedPoseSession, runPoseInference, type PoseSessionLike } from './workerCore.ts';

export interface PoseWorkerRequest { id: number; model: ArrayBuffer; manifest: ModelManifest; image: ImageDataLike; probe: PoseProbe; wasm?: { bytes: ArrayBuffer; manifest: RuntimeAssetManifest }; }
export interface PoseWorkerResponse { id: number; keypoints?: Awaited<ReturnType<typeof runPoseInference>>; provider?: string; error?: string; }
let generation = 0;
let session: PoseSessionLike | undefined;
let loadedModelId = '';

const workerScope = self as unknown as { onmessage: ((event: MessageEvent<PoseWorkerRequest>) => void) | null; postMessage(message: unknown, transfer?: Transferable[]): void };
workerScope.onmessage = (event) => { void handleMessage(event); };
async function handleMessage(event: MessageEvent<PoseWorkerRequest>): Promise<void> {
  const request = event.data; const currentGeneration = ++generation;
  try {
    let provider = request.probe.executionProvider;
    if (!session || loadedModelId !== request.manifest.id) {
      const created = await createVerifiedPoseSession({ create: (model, options) => ort.InferenceSession.create(model, options), setWasmBinary: (bytes) => { ort.env.wasm.wasmBinary = bytes; } }, request.model, provider, request.probe.numThreads, request.wasm);
      session = created.session;
      provider = created.provider;
      loadedModelId = request.manifest.id;
    }
    if (currentGeneration !== generation) return;
    const keypoints = await runPoseInference(session, request.image, request.manifest, (data, dims) => new ort.Tensor('float32', data, dims));
    if (currentGeneration !== generation) return;
    workerScope.postMessage({ id: request.id, keypoints, provider });
  } catch (error) {
    if (currentGeneration !== generation) return;
    workerScope.postMessage({ id: request.id, error: error instanceof Error ? error.message : 'Pose inference failed' });
  }
};
