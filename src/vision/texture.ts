/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- DOM and Worker compiler overloads differ; explicit 2D context narrows the combined build. */
export interface TextureBBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface TextureResult {
  texturePng: Blob;
  bbox: TextureBBox;
  maskPng: Blob;
  width: number;
  height: number;
}
interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray | Uint8Array;
}

/** Compose a transparent cutout and a consistently resized mask from RGBA pixels. */
export async function toTexture(
  drawing: ImageData | RgbaImage,
  mask: Uint8Array,
): Promise<TextureResult> {
  const { width, height } = drawing;
  if (mask.length !== width * height)
    throw new Error('Mask dimensions do not match drawing');
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      if ((mask[y * width + x] ?? 0) !== 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  if (maxX < 0) {
    minX = 0;
    minY = 0;
    maxX = width - 1;
    maxY = height - 1;
  }
  const bbox = {
    x: Math.max(0, minX - 8),
    y: Math.max(0, minY - 8),
    width: Math.min(width, maxX + 9) - Math.max(0, minX - 8),
    height: Math.min(height, maxY + 9) - Math.max(0, minY - 8),
  };
  const scale = Math.min(1, 1024 / Math.max(bbox.width, bbox.height));
  const outWidth = Math.max(1, Math.round(bbox.width * scale));
  const outHeight = Math.max(1, Math.round(bbox.height * scale));
  // Render at the unscaled bbox size first. A smaller destination canvas would
  // make putImageData clip large source drawings before the <=1024px resize.
  const textureCanvas = createCanvas(bbox.width, bbox.height);
  const maskCanvas = createCanvas(bbox.width, bbox.height);
  const textureContext = textureCanvas.getContext('2d') as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  const maskContext = maskCanvas.getContext('2d') as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!textureContext || !maskContext)
    throw new Error('Canvas 2D context unavailable');
  const pixels = new Uint8ClampedArray(bbox.width * bbox.height * 4);
  const maskPixels = new Uint8ClampedArray(pixels.length);
  for (let y = 0; y < bbox.height; y += 1)
    for (let x = 0; x < bbox.width; x += 1) {
      const src = (bbox.y + y) * width + bbox.x + x;
      const dst = (y * bbox.width + x) * 4;
      const alpha = mask[src] ?? 0;
      pixels[dst] = drawing.data[src * 4] ?? 0;
      pixels[dst + 1] = drawing.data[src * 4 + 1] ?? 0;
      pixels[dst + 2] = drawing.data[src * 4 + 2] ?? 0;
      pixels[dst + 3] = alpha;
      maskPixels[dst] = alpha;
      maskPixels[dst + 1] = alpha;
      maskPixels[dst + 2] = alpha;
      maskPixels[dst + 3] = 255;
    }
  const imageData = textureContext.createImageData(bbox.width, bbox.height);
  imageData.data.set(pixels);
  const maskData = maskContext.createImageData(bbox.width, bbox.height);
  maskData.data.set(maskPixels);
  textureContext.putImageData(imageData, 0, 0);
  maskContext.putImageData(maskData, 0, 0);
  if (scale !== 1) {
    const textureScaled = createCanvas(outWidth, outHeight);
    const textureScaledContext = textureScaled.getContext('2d') as
      CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    const maskScaled = createCanvas(outWidth, outHeight);
    const maskScaledContext = maskScaled.getContext('2d') as
      CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!textureScaledContext || !maskScaledContext)
      throw new Error('Canvas 2D context unavailable');
    textureScaledContext.drawImage(textureCanvas, 0, 0, outWidth, outHeight);
    maskScaledContext.drawImage(maskCanvas, 0, 0, outWidth, outHeight);
    return {
      texturePng: await canvasToBlob(textureScaled),
      bbox,
      maskPng: await canvasToBlob(maskScaled),
      width: outWidth,
      height: outHeight,
    };
  }
  return {
    texturePng: await canvasToBlob(textureCanvas),
    bbox,
    maskPng: await canvasToBlob(maskCanvas),
    width: outWidth,
    height: outHeight,
  };
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

function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
): Promise<Blob> {
  if (isOffscreenCanvas(canvas))
    return canvas.convertToBlob({ type: 'image/png' });
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value ? resolve(value) : reject(new Error('PNG encoding failed')),
      'image/png',
    ),
  );
}

function isOffscreenCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
): canvas is OffscreenCanvas {
  return (
    typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas
  );
}
