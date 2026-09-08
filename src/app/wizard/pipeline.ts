import { charactersRepo } from '@/storage/repos/characters';
import type { Character, BlobRecord, Drawing } from '@/domain/types';
import { buildRig } from '@/rig/buildRig';
import type { JointMap } from '@/pose/mapping';
import { toTexture } from '@/vision/texture';
import type { SegmentResult } from '@/vision/segment';
export function imagePixels(bitmap: ImageBitmap): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
export async function pixelsPng(pixels: ImageData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.putImageData(pixels, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('PNG encoding failed')),
      'image/png',
    ),
  );
}
export function segmentAsync(
  imageData: ImageData,
  signal?: AbortSignal,
): Promise<SegmentResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../../vision/vision.worker.ts', import.meta.url),
      { type: 'module' },
    );
    const cleanup = () => {
      worker.terminate();
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = (
      event: MessageEvent<{ result?: SegmentResult; error?: string }>,
    ) => {
      cleanup();
      if (event.data.result) resolve(event.data.result);
      else reject(new Error(event.data.error));
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error('Segmentation failed'));
    };
    worker.postMessage({ id: 1, imageData });
  });
}
export async function prepareTexture(pixels: ImageData, mask: Uint8Array) {
  const texture = await toTexture(pixels, mask);
  const bitmap = await createImageBitmap(texture.texturePng);
  try {
    const image = imagePixels(bitmap);
    const localMask = new Uint8Array(image.width * image.height);
    for (let i = 0; i < localMask.length; i++)
      localMask[i] = (image.data[i * 4 + 3] ?? 0) > 127 ? 255 : 0;
    return { blob: texture.texturePng, image, mask: localMask };
  } finally {
    bitmap.close();
  }
}
export async function buildCharacterRecords(input: {
  name: string;
  source: 'file' | 'camera';
  drawing: ImageData;
  texture: Blob;
  textureImage: ImageData;
  mask: Uint8Array;
  joints: JointMap;
  rigType: 'humanoid' | 'cutout';
}) {
  const now = Date.now();
  const blobRecord = (blob: Blob): BlobRecord => ({
    id: crypto.randomUUID(),
    mime: blob.type,
    data: blob,
    size: blob.size,
    createdAt: now,
  });
  const original = blobRecord(await pixelsPng(input.drawing));
  const texture = blobRecord(input.texture);
  const thumbCanvas = document.createElement('canvas');
  const scale = Math.min(
    1,
    256 / Math.max(input.textureImage.width, input.textureImage.height),
  );
  thumbCanvas.width = Math.max(1, Math.round(input.textureImage.width * scale));
  thumbCanvas.height = Math.max(
    1,
    Math.round(input.textureImage.height * scale),
  );
  const bitmap = await createImageBitmap(input.texture);
  thumbCanvas
    .getContext('2d')
    ?.drawImage(bitmap, 0, 0, thumbCanvas.width, thumbCanvas.height);
  bitmap.close();
  const thumbBlob = await new Promise<Blob>((resolve, reject) =>
    thumbCanvas.toBlob(
      (value) =>
        value ? resolve(value) : reject(new Error('Thumbnail failed')),
      'image/png',
    ),
  );
  const thumb = blobRecord(thumbBlob);
  const drawing: Drawing = {
    id: crypto.randomUUID(),
    createdAt: now,
    source: input.source,
    imageBlobId: original.id,
    width: input.drawing.width,
    height: input.drawing.height,
  };
  const rig =
    input.rigType === 'humanoid'
      ? buildRig(
          input.mask,
          input.textureImage.width,
          input.textureImage.height,
          input.joints,
        )
      : null;
  const character: Character = {
    id: crypto.randomUUID(),
    name: input.name,
    createdAt: now,
    updatedAt: now,
    rigType: input.rigType,
    drawingId: drawing.id,
    textureBlobId: texture.id,
    thumbBlobId: thumb.id,
    rig,
    effectPrefs: {
      effectIds: input.rigType === 'cutout' ? ['float'] : [],
      intensity: 0.5,
    },
  };
  return { drawing, character, blobs: [original, texture, thumb] };
}

export async function saveDrawingCharacter(
  input: Parameters<typeof buildCharacterRecords>[0],
): Promise<Character> {
  const records = await buildCharacterRecords(input);
  await charactersRepo.saveCharacter(records);
  return records.character;
}
