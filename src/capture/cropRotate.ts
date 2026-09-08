/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- DOM and Worker compiler overloads differ; explicit 2D context narrows the combined build. */
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

/** Crop first, then rotate the crop. The returned bitmap is clamped to a 2048px edge. */
export async function cropRotate(
  source: Blob | ImageBitmap,
  input: CropRotateInput,
): Promise<ImageBitmap> {
  const bitmap =
    source instanceof Blob
      ? await createImageBitmap(source, { imageOrientation: 'from-image' })
      : source;
  const rect = clampRect(input.rect, bitmap.width, bitmap.height);
  const angle = ((input.rotationDeg ?? 0) * Math.PI) / 180;
  const cropWidth = Math.max(1, Math.round(rect.width));
  const cropHeight = Math.max(1, Math.round(rect.height));
  const crop = createCanvas(cropWidth, cropHeight);
  const cropContext = crop.getContext('2d') as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!cropContext) throw new Error('Canvas 2D context unavailable');
  cropContext.drawImage(
    bitmap,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    cropWidth,
    cropHeight,
  );
  const [rotatedWidth, rotatedHeight] = rotatedDimensions(
    cropWidth,
    cropHeight,
    input.rotationDeg ?? 0,
  );
  const canvas = createCanvas(rotatedWidth, rotatedHeight);
  const context = canvas.getContext('2d') as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!context) throw new Error('Canvas 2D context unavailable');
  context.translate(rotatedWidth / 2, rotatedHeight / 2);
  context.rotate(angle);
  context.drawImage(crop, -cropWidth / 2, -cropHeight / 2);
  const outWidth = rotatedWidth;
  const outHeight = rotatedHeight;
  const scale = Math.min(1, 2048 / Math.max(outWidth, outHeight));
  const finalWidth = Math.max(1, Math.round(outWidth * scale));
  const finalHeight = Math.max(1, Math.round(outHeight * scale));
  if (scale !== 1) {
    const finalCanvas = createCanvas(finalWidth, finalHeight);
    const finalContext = finalCanvas.getContext('2d') as
      CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!finalContext) throw new Error('Canvas 2D context unavailable');
    finalContext.drawImage(canvas, 0, 0, finalWidth, finalHeight);
    return canvasToBitmap(finalCanvas);
  }
  return canvasToBitmap(canvas);
}

/** Name used by the crop step specification; kept as an explicit alias for callers. */
export const applyCrop = cropRotate;

export function rotatedDimensions(
  width: number,
  height: number,
  rotationDeg: number,
): [number, number] {
  const angle = (rotationDeg * Math.PI) / 180;
  const rawSin = Math.abs(Math.sin(angle));
  const rawCos = Math.abs(Math.cos(angle));
  // Avoid 90° becoming 90.00000000000001 due to floating point rounding.
  const sin = rawSin < 1e-10 ? 0 : rawSin > 1 - 1e-10 ? 1 : rawSin;
  const cos = rawCos < 1e-10 ? 0 : rawCos > 1 - 1e-10 ? 1 : rawCos;
  return [
    Math.max(1, Math.ceil(width * cos + height * sin)),
    Math.max(1, Math.ceil(width * sin + height * cos)),
  ];
}

export function clampRect(
  rect: CropRect,
  width: number,
  height: number,
): CropRect {
  const x = Math.max(0, Math.min(width, rect.x));
  const y = Math.max(0, Math.min(height, rect.y));
  const right = Math.max(x, Math.min(width, rect.x + Math.max(0, rect.width)));
  const bottom = Math.max(
    y,
    Math.min(height, rect.y + Math.max(0, rect.height)),
  );
  return { x, y, width: right - x, height: bottom - y };
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
  throw new Error('Canvas unavailable');
}

async function canvasToBitmap(
  canvas: HTMLCanvasElement | OffscreenCanvas,
): Promise<ImageBitmap> {
  const blob = isOffscreenCanvas(canvas)
    ? await canvas.convertToBlob({ type: 'image/png' })
    : await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value ? resolve(value) : reject(new Error('PNG encoding failed')),
          'image/png',
        ),
      );
  return createImageBitmap(blob);
}

function isOffscreenCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
): canvas is OffscreenCanvas {
  return (
    typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas
  );
}
