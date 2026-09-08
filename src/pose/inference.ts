export interface PoseNormalization {
  mean: readonly [number, number, number];
  std: readonly [number, number, number];
}
export interface PoseInputSpec {
  inputWidth: number;
  inputHeight: number;
  normalization: PoseNormalization;
}
export interface ImageDataLike {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray | Uint8Array;
}
export interface LetterboxTransform {
  scale: number;
  padX: number;
  padY: number;
  sourceWidth: number;
  sourceHeight: number;
  inputWidth: number;
  inputHeight: number;
}
export interface LetterboxResult {
  tensor: Float32Array;
  transform: LetterboxTransform;
}
export const COCO_KEYPOINT_NAMES = [
  'nose',
  'left_eye',
  'right_eye',
  'left_ear',
  'right_ear',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
] as const;
export interface DecodedKeypoint {
  name: (typeof COCO_KEYPOINT_NAMES)[number];
  x: number;
  y: number;
  confidence: number;
}

export function letterbox(
  image: ImageDataLike,
  spec: PoseInputSpec,
): LetterboxResult {
  const scale = Math.min(
    spec.inputWidth / image.width,
    spec.inputHeight / image.height,
  );
  const resizedWidth = Math.max(1, Math.round(image.width * scale));
  const resizedHeight = Math.max(1, Math.round(image.height * scale));
  const padX = (spec.inputWidth - resizedWidth) / 2;
  const padY = (spec.inputHeight - resizedHeight) / 2;
  const tensor = new Float32Array(3 * spec.inputWidth * spec.inputHeight);
  for (let y = 0; y < resizedHeight; y += 1)
    for (let x = 0; x < resizedWidth; x += 1) {
      const sx = Math.min(image.width - 1, Math.floor(x / scale));
      const sy = Math.min(image.height - 1, Math.floor(y / scale));
      const source = (sy * image.width + sx) * 4;
      const destination =
        Math.floor(y + padY) * spec.inputWidth + Math.floor(x + padX);
      for (let channel = 0; channel < 3; channel += 1)
        tensor[channel * spec.inputWidth * spec.inputHeight + destination] =
          ((image.data[source + channel] ?? 0) -
            spec.normalization.mean[channel]!) /
          spec.normalization.std[channel]!;
    }
  return {
    tensor,
    transform: {
      scale,
      padX,
      padY,
      sourceWidth: image.width,
      sourceHeight: image.height,
      inputWidth: spec.inputWidth,
      inputHeight: spec.inputHeight,
    },
  };
}

export function decodeHeatmaps(
  heatmaps: Float32Array | readonly number[],
  heatmapWidth: number,
  heatmapHeight: number,
  transform: LetterboxTransform,
): DecodedKeypoint[] {
  const output: DecodedKeypoint[] = [];
  const count = COCO_KEYPOINT_NAMES.length;
  for (let joint = 0; joint < count; joint += 1) {
    let bestIndex = 0;
    let bestValue = -Infinity;
    for (let index = 0; index < heatmapWidth * heatmapHeight; index += 1) {
      const value =
        heatmaps[joint * heatmapWidth * heatmapHeight + index] ?? -Infinity;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
    }
    const peakX = bestIndex % heatmapWidth;
    const peakY = Math.floor(bestIndex / heatmapWidth);
    const offsetX = parabolicOffset(
      heatmaps,
      joint * heatmapWidth * heatmapHeight + bestIndex - 1,
      joint * heatmapWidth * heatmapHeight + bestIndex,
      joint * heatmapWidth * heatmapHeight + bestIndex + 1,
      peakX > 0 && peakX + 1 < heatmapWidth,
    );
    const offsetY = parabolicOffset(
      heatmaps,
      joint * heatmapWidth * heatmapHeight + bestIndex - heatmapWidth,
      joint * heatmapWidth * heatmapHeight + bestIndex,
      joint * heatmapWidth * heatmapHeight + bestIndex + heatmapWidth,
      peakY > 0 && peakY + 1 < heatmapHeight,
    );
    const inputX =
      (((peakX + offsetX + 0.5) * transform.inputWidth) / heatmapWidth -
        transform.padX) /
      transform.scale;
    const inputY =
      (((peakY + offsetY + 0.5) * transform.inputHeight) / heatmapHeight -
        transform.padY) /
      transform.scale;
    output.push({
      name: COCO_KEYPOINT_NAMES[joint]!,
      x: Math.max(0, Math.min(transform.sourceWidth - 1, inputX)),
      y: Math.max(0, Math.min(transform.sourceHeight - 1, inputY)),
      confidence: bestValue,
    });
  }
  return output;
}

function parabolicOffset(
  values: Float32Array | readonly number[],
  left: number,
  center: number,
  right: number,
  valid: boolean,
): number {
  if (!valid) return 0;
  const l = values[left] ?? 0;
  const c = values[center] ?? 0;
  const r = values[right] ?? 0;
  const denominator = l - 2 * c + r;
  return denominator === 0
    ? 0
    : Math.max(-0.5, Math.min(0.5, (0.5 * (l - r)) / denominator));
}
