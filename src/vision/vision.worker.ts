import { segment, type SegmentOptions, type SegmentResult } from './segment.ts';

export interface VisionRequest {
  id: string | number;
  imageData: ImageData;
  opts?: SegmentOptions;
}
export interface VisionResponse {
  id: string | number;
  result?: SegmentResult;
  error?: string;
}

let generation = 0;
const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<VisionRequest>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};
workerScope.onmessage = (event: MessageEvent<VisionRequest>) => {
  const request = event.data;
  const currentGeneration = ++generation;
  try {
    const result = segment(request.imageData, request.opts);
    if (currentGeneration !== generation) return;
    workerScope.postMessage({ id: request.id, result }, [result.mask.buffer]);
  } catch (error) {
    if (currentGeneration !== generation) return;
    workerScope.postMessage({
      id: request.id,
      error: error instanceof Error ? error.message : 'Segmentation failed',
    });
  }
};
