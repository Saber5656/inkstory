/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- DOM and Worker compiler overloads differ; explicit 2D context narrows the combined build. */
export interface ReencodedImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  png: Blob;
}

const MAX_BYTES = 40 * 1024 * 1024;
const MAX_DECODED_EDGE = 8192;
const MAX_OUTPUT_EDGE = 2048;

export class ImageInputError extends Error {
  readonly messageKey: string;

  constructor(messageKey: string, message = messageKey) {
    super(message);
    this.name = 'ImageInputError';
    this.messageKey = messageKey;
  }
}

/** Decode with EXIF orientation applied, downscale, and discard the source container. */
export async function reencode(blob: Blob): Promise<ReencodedImage> {
  if (blob.size > MAX_BYTES)
    throw new ImageInputError('capture.errors.tooLarge');
  if (!blob.type.startsWith('image/')) {
    throw new ImageInputError('capture.errors.notImage');
  }
  if (typeof createImageBitmap !== 'function') {
    throw new ImageInputError('capture.errors.decodeFailed');
  }

  let source: ImageBitmap;
  try {
    source = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageInputError('capture.errors.decodeFailed');
  }
  if (source.width > MAX_DECODED_EDGE || source.height > MAX_DECODED_EDGE) {
    source.close();
    throw new ImageInputError('capture.errors.dimensionsTooLarge');
  }

  const scale = Math.min(
    1,
    MAX_OUTPUT_EDGE / Math.max(source.width, source.height),
  );
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d') as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!context) {
    source.close();
    throw new ImageInputError('capture.errors.decodeFailed');
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, width, height);
  const encoded = await canvasToBlob(canvas, 'image/png');
  const png = await stripPngMetadata(encoded);
  source.close();
  const bitmap = await createImageBitmap(png, { imageOrientation: 'none' });
  return { bitmap, width, height, png };
}

function createCanvas(
  width: number,
  height: number,
): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined')
    return new OffscreenCanvas(width, height);
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw new ImageInputError('capture.errors.decodeFailed');
}

function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  type: string,
): Promise<Blob> {
  if (isOffscreenCanvas(canvas)) return canvas.convertToBlob({ type });
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error('PNG encoding failed')),
      type,
    );
  });
}

/** Keep PNG pixel chunks only so browser encoders cannot retain EXIF/GPS data. */
async function stripPngMetadata(blob: Blob): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    bytes.length < signature.length ||
    signature.some((value, index) => bytes[index] !== value)
  )
    throw new ImageInputError('capture.errors.decodeFailed');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: Uint8Array[] = [bytes.slice(0, signature.length)];
  let offset = signature.length;
  let ended = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length)
      throw new ImageInputError('capture.errors.decodeFailed');
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > bytes.length)
      throw new ImageInputError('capture.errors.decodeFailed');
    const type = new TextDecoder().decode(bytes.slice(offset + 4, offset + 8));
    if (
      type === 'IHDR' ||
      type === 'PLTE' ||
      type === 'IDAT' ||
      type === 'IEND'
    )
      chunks.push(bytes.slice(offset, end));
    offset = end;
    if (type === 'IEND') {
      ended = true;
      break;
    }
  }
  if (!ended) throw new ImageInputError('capture.errors.decodeFailed');
  const output = new Uint8Array(
    chunks.reduce((sum, chunk) => sum + chunk.length, 0),
  );
  let outputOffset = 0;
  for (const chunk of chunks) {
    output.set(chunk, outputOffset);
    outputOffset += chunk.length;
  }
  return new Blob([output as unknown as BlobPart], { type: 'image/png' });
}

function isOffscreenCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
): canvas is OffscreenCanvas {
  return (
    typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas
  );
}
