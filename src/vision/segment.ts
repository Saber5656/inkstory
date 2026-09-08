export interface SegmentOptions {
  /** 0..1; larger values make foreground threshold more permissive. */
  sensitivity?: number;
}

export interface SegmentResult {
  mask: Uint8Array;
  coverage: number;
  ok: boolean;
}

interface PixelImage { readonly width: number; readonly height: number; readonly data: Uint8ClampedArray | Uint8Array; }

/**
 * Classical segmentation port from Meta AnimatedDrawings
 * `examples/image_to_annotations.py` (MIT, archived repository, 2025-09-03).
 * The upstream implementation uses OpenCV adaptiveThreshold(ADAPTIVE_THRESH_GAUSSIAN_C,
 * blockSize=115, C=8), followed by close x2, dilate x2 and edge flood fill.
 */
export function segment(img: ImageData | PixelImage, opts: SegmentOptions = {}): SegmentResult {
  const width = img.width;
  const height = img.height;
  if (width <= 0 || height <= 0 || img.data.length < width * height * 4) {
    return { mask: new Uint8Array(0), coverage: 0, ok: false };
  }
  const gray = new Uint8Array(width * height);
  for (let p = 0, i = 0; p < gray.length; p += 1, i += 4) {
    const r = img.data[i] ?? 255;
    const g = img.data[i + 1] ?? 255;
    const b = img.data[i + 2] ?? 255;
    gray[p] = Math.min(r, g, b);
  }
  const sensitivity = Math.max(0, Math.min(1, opts.sensitivity ?? 0.5));
  const localMean = gaussianMean(gray, width, height);
  const binary = new Uint8Array(gray.length);
  // OpenCV's binary inverse marks darker-than-local pixels as foreground. C=8;
  // slider varies this offset around the upstream value while preserving polarity.
  const offset = 4 + sensitivity * 8;
  for (let i = 0; i < binary.length; i += 1) {
    binary[i] = gray[i]! < localMean[i]! - offset ? 255 : 0;
  }
  let mask = close(binary, width, height, 2);
  mask = dilate(mask, width, height, 2);
  floodEdgeBackground(mask, width, height);
  mask = largestComponent(mask, width, height);
  fillHoles(mask, width, height);
  let foreground = 0;
  for (const value of mask) if (value !== 0) foreground += 1;
  const coverage = foreground / mask.length;
  return { mask, coverage, ok: coverage >= 0.02 && coverage <= 0.98 };
}

import { close, dilate } from './morphology.ts';

function gaussianMean(input: Uint8Array, width: number, height: number): Uint8Array {
  const radius = 57;
  const sigma = 115 / 6;
  const weights = new Float64Array(radius + 1);
  let sum = 0;
  for (let i = 0; i <= radius; i += 1) {
    weights[i] = Math.exp(-(i * i) / (2 * sigma * sigma));
    sum += i === 0 ? weights[i]! : 2 * weights[i]!;
  }
  for (let i = 0; i <= radius; i += 1) weights[i] = weights[i]! / sum;
  const horizontal = new Float64Array(input.length);
  const output = new Uint8Array(input.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = 0;
      for (let dx = -radius; dx <= radius; dx += 1) {
        const xx = Math.max(0, Math.min(width - 1, x + dx));
        value += input[y * width + xx]! * weights[Math.abs(dx)]!;
      }
      horizontal[y * width + x] = value;
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        const yy = Math.max(0, Math.min(height - 1, y + dy));
        value += horizontal[yy * width + x]! * weights[Math.abs(dy)]!;
      }
      output[y * width + x] = Math.round(value);
    }
  }
  return output;
}

function floodEdgeBackground(mask: Uint8Array, width: number, height: number): void {
  const seen = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let head = 0;
  let tail = 0;
  const add = (x: number, y: number) => {
    const index = y * width + x;
    if (seen[index] === 0 && mask[index] === 0) { seen[index] = 1; queue[tail++] = index; }
  };
  for (let i = 0; i < 10; i += 1) {
    add(Math.round(i * (width - 1) / 9), 0); add(Math.round(i * (width - 1) / 9), height - 1);
    add(0, Math.round(i * (height - 1) / 9)); add(width - 1, Math.round(i * (height - 1) / 9));
  }
  while (head < tail) {
    const index = queue[head++]!;
    const x = index % width; const y = Math.floor(index / width);
    if (x > 0) add(x - 1, y); if (x + 1 < width) add(x + 1, y);
    if (y > 0) add(x, y - 1); if (y + 1 < height) add(x, y + 1);
  }
  // Flooded edge-connected zeroes are background and remain zero. Keeping this
  // explicit makes the polarity obvious and prevents a white border becoming
  // the selected largest component.
  for (let i = 0; i < mask.length; i += 1) if (seen[i] !== 0) mask[i] = 0;
}

function largestComponent(input: Uint8Array, width: number, height: number): Uint8Array {
  const visited = new Uint8Array(input.length);
  const queue = new Int32Array(input.length);
  let largest = 0;
  let largestCount = 0;
  for (let start = 0; start < input.length; start += 1) {
    if (input[start] === 0 || visited[start] !== 0) continue;
    let head = 0; let tail = 0; let count = 0;
    const visit = (index: number) => { if (input[index] !== 0 && visited[index] === 0) { visited[index] = 1; queue[tail++] = index; } };
    queue[tail++] = start; visited[start] = 1;
    while (head < tail) {
      const index = queue[head++]!; count += 1;
      const x = index % width; const y = Math.floor(index / width);
      if (x > 0) visit(index - 1); if (x + 1 < width) visit(index + 1);
      if (y > 0) visit(index - width); if (y + 1 < height) visit(index + width);
    }
    if (count > largestCount) { largestCount = count; largest = start; }
  }
  const output = new Uint8Array(input.length);
  if (largestCount === 0) return output;
  let head = 0; let tail = 0; queue[tail++] = largest; output[largest] = 255;
  const copy = (index: number) => { if (input[index] !== 0 && output[index] === 0) { output[index] = 255; queue[tail++] = index; } };
  while (head < tail) {
    const index = queue[head++]!; const x = index % width; const y = Math.floor(index / width);
    if (x > 0) copy(index - 1); if (x + 1 < width) copy(index + 1);
    if (y > 0) copy(index - width); if (y + 1 < height) copy(index + width);
  }
  return output;
}

function fillHoles(mask: Uint8Array, width: number, height: number): void {
  const outside = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length); let head = 0; let tail = 0;
  const add = (index: number) => { if (mask[index] === 0 && outside[index] === 0) { outside[index] = 1; queue[tail++] = index; } };
  for (let x = 0; x < width; x += 1) { add(x); add((height - 1) * width + x); }
  for (let y = 0; y < height; y += 1) { add(y * width); add(y * width + width - 1); }
  while (head < tail) { const i = queue[head++]!; const x = i % width; const y = Math.floor(i / width); if (x > 0) add(i - 1); if (x + 1 < width) add(i + 1); if (y > 0) add(i - width); if (y + 1 < height) add(i + width); }
  for (let i = 0; i < mask.length; i += 1) if (mask[i] === 0 && outside[i] === 0) mask[i] = 255;
}
