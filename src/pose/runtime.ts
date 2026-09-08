/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- Narrow combined DOM/Worker Canvas overloads. */
import { loadPoseModel, type ModelLoadResult } from './modelLoader.ts';
import { detectCapabilities, selectExecutionProvider } from './probe.ts';
import type { DecodedKeypoint, ImageDataLike } from './inference.ts';

export type PoseResult =
  | { available: true; keypoints: DecodedKeypoint[]; executionProvider: string }
  | { available: false; reason: string; detail?: string };
export interface PoseRuntimeOptions {
  loadModel?: () => Promise<ModelLoadResult>;
  workerFactory?: (url: URL, options: WorkerOptions) => Worker;
}

let nextRequestId = 1;
/** Estimate once during character creation; any runtime failure resolves to manual fallback. */
export async function estimatePose(
  texture: ImageBitmap,
  options: PoseRuntimeOptions = {},
): Promise<PoseResult> {
  const loaded = await (options.loadModel ?? loadPoseModel)();
  if (!loaded.available) return loaded;
  if (typeof Worker === 'undefined')
    return { available: false, reason: 'worker' };
  const probe = selectExecutionProvider(detectCapabilities());
  const worker = (
    options.workerFactory ??
    ((url, workerOptions) => new Worker(url, workerOptions))
  )(new URL('./pose.worker.ts', import.meta.url), { type: 'module' });
  const id = nextRequestId++;
  try {
    const image = imageBitmapToImageData(texture);
    const response = await new Promise<{
      keypoints?: DecodedKeypoint[];
      provider?: string;
      error?: string;
    }>((resolve) => {
      worker.onmessage = (
        event: MessageEvent<{
          id: number;
          keypoints?: DecodedKeypoint[];
          provider?: string;
          error?: string;
        }>,
      ) => {
        if (event.data.id === id) resolve(event.data);
      };
      worker.onerror = () => resolve({ error: 'Pose worker failed' });
      const wasm = loaded.wasm;
      const transfer: Transferable[] = [loaded.bytes];
      if (wasm) transfer.push(wasm.bytes);
      worker.postMessage(
        {
          id,
          model: loaded.bytes,
          manifest: loaded.manifest,
          image,
          probe,
          wasm,
        },
        transfer,
      );
    });
    if (!response.keypoints)
      return { available: false, reason: 'inference', detail: response.error };
    return {
      available: true,
      keypoints: response.keypoints,
      executionProvider: response.provider ?? probe.executionProvider,
    };
  } catch (error) {
    return {
      available: false,
      reason: 'inference',
      detail: error instanceof Error ? error.message : undefined,
    };
  } finally {
    worker.terminate();
  }
}

function imageBitmapToImageData(bitmap: ImageBitmap): ImageDataLike {
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(bitmap.width, bitmap.height)
      : createDomCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d') as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!context) throw new Error('Canvas 2D context unavailable');
  context.drawImage(bitmap, 0, 0);
  return context.getImageData(0, 0, bitmap.width, bitmap.height);
}
function createDomCanvas(width: number, height: number): HTMLCanvasElement {
  if (typeof document === 'undefined') throw new Error('Canvas unavailable');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
