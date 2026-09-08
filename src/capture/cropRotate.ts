export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropRotateInput {
  rect: CropRect;
  rotationDeg?: number;
}

/** Crop an image after rotation. The returned bitmap is clamped to a 2048px edge. */
export async function cropRotate(
  source: Blob | ImageBitmap,
  input: CropRotateInput,
): Promise<ImageBitmap> {
  const bitmap = source instanceof Blob
    ? await createImageBitmap(source, { imageOrientation: 'from-image' })
    : source;
  const rect = clampRect(input.rect, bitmap.width, bitmap.height);
  const angle = (input.rotationDeg ?? 0) * Math.PI / 180;
  const sin = Math.abs(Math.sin(angle));
  const cos = Math.abs(Math.cos(angle));
  const rotatedWidth = Math.ceil(bitmap.width * cos + bitmap.height * sin);
  const rotatedHeight = Math.ceil(bitmap.width * sin + bitmap.height * cos);
  const rotated = createCanvas(rotatedWidth, rotatedHeight);
  const rotatedContext = rotated.getContext('2d');
  if (!rotatedContext) throw new Error('Canvas 2D context unavailable');
  rotatedContext.translate(rotatedWidth / 2, rotatedHeight / 2);
  rotatedContext.rotate(angle);
  rotatedContext.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

  // Map the source crop center into the rotated canvas. Rotation is around image center.
  const cx = rect.x + rect.width / 2 - bitmap.width / 2;
  const cy = rect.y + rect.height / 2 - bitmap.height / 2;
  const centerX = rotatedWidth / 2 + cx * Math.cos(angle) - cy * Math.sin(angle);
  const centerY = rotatedHeight / 2 + cx * Math.sin(angle) + cy * Math.cos(angle);
  const outWidth = Math.max(1, Math.round(rect.width));
  const outHeight = Math.max(1, Math.round(rect.height));
  const canvas = createCanvas(outWidth, outHeight);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');
  context.drawImage(rotated, centerX - outWidth / 2, centerY - outHeight / 2, outWidth, outHeight,
    0, 0, outWidth, outHeight);
  const scale = Math.min(1, 2048 / Math.max(outWidth, outHeight));
  const finalWidth = Math.max(1, Math.round(outWidth * scale));
  const finalHeight = Math.max(1, Math.round(outHeight * scale));
  if (scale !== 1) {
    const finalCanvas = createCanvas(finalWidth, finalHeight);
    const finalContext = finalCanvas.getContext('2d');
    if (!finalContext) throw new Error('Canvas 2D context unavailable');
    finalContext.drawImage(canvas, 0, 0, finalWidth, finalHeight);
    return canvasToBitmap(finalCanvas);
  }
  return canvasToBitmap(canvas);
}

/** Name used by the crop step specification; kept as an explicit alias for callers. */
export const applyCrop = cropRotate;

export function clampRect(rect: CropRect, width: number, height: number): CropRect {
  const x = Math.max(0, Math.min(width, rect.x));
  const y = Math.max(0, Math.min(height, rect.y));
  const right = Math.max(x, Math.min(width, rect.x + Math.max(0, rect.width)));
  const bottom = Math.max(y, Math.min(height, rect.y + Math.max(0, rect.height)));
  return { x, y, width: right - x, height: bottom - y };
}

function createCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw new Error('Canvas unavailable');
}

async function canvasToBitmap(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<ImageBitmap> {
  const blob = canvas instanceof OffscreenCanvas
    ? await canvas.convertToBlob({ type: 'image/png' })
    : await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('PNG encoding failed')), 'image/png'));
  return createImageBitmap(blob);
}
