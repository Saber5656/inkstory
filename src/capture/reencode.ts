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
  if (blob.size > MAX_BYTES) throw new ImageInputError('capture.errors.tooLarge');
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

  const scale = Math.min(1, MAX_OUTPUT_EDGE / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) {
    source.close();
    throw new ImageInputError('capture.errors.decodeFailed');
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, width, height);
  const png = await canvasToBlob(canvas, 'image/png');
  source.close();
  const bitmap = await createImageBitmap(png, { imageOrientation: 'none' });
  return { bitmap, width, height, png };
}

function createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
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
  if (canvas instanceof OffscreenCanvas) return canvas.convertToBlob({ type });
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), type);
  });
}
