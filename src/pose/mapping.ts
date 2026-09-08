export const JOINT_NAMES = [
  'root', 'hip', 'torso', 'neck', 'right_shoulder', 'right_elbow', 'right_hand',
  'left_shoulder', 'left_elbow', 'left_hand', 'right_hip', 'right_knee', 'right_foot',
  'left_hip', 'left_knee', 'left_foot',
] as const;
export type JointName = typeof JOINT_NAMES[number];
export interface Point { x: number; y: number; }
export type JointMap = { [name in JointName]: Point };
export interface CocoKeypoint { x: number; y: number; score?: number; confidence?: number; }
export type Keypoint17 = CocoKeypoint | readonly [number, number] | readonly [number, number, number];

/**
 * COCO-17 to AnimatedDrawings' 16-joint skeleton. Index and left/right choices
 * follow upstream `examples/image_to_annotations.py` (MIT, archived source).
 * Character right is the viewer's left, matching the upstream config convention.
 */
export function cocoToSkeleton(keypoints17: readonly Keypoint17[], textureSize?: { width: number; height: number }): JointMap {
  if (keypoints17.length < 17) throw new Error('Expected 17 COCO keypoints');
  const p = (index: number): Point => {
    const point = keypoints17[index];
    if (!point) throw new Error(`Missing COCO keypoint ${index}`);
    if (Array.isArray(point)) return { x: Number(point[0]), y: Number(point[1]) };
    if ('x' in point && 'y' in point) return { x: point.x, y: point.y };
    throw new Error(`Invalid COCO keypoint ${index}`);
  };
  const leftShoulder = p(5); const rightShoulder = p(6);
  const leftHip = p(11); const rightHip = p(12);
  const neck = midpoint(leftShoulder, rightShoulder);
  const hip = midpoint(leftHip, rightHip);
  const root = { x: hip.x, y: hip.y + (textureSize?.height ?? 0) * 0.03 };
  return {
    root,
    hip,
    torso: midpoint(neck, hip),
    neck,
    right_shoulder: rightShoulder,
    right_elbow: p(8),
    right_hand: p(10),
    left_shoulder: leftShoulder,
    left_elbow: p(7),
    left_hand: p(9),
    right_hip: rightHip,
    right_knee: p(14),
    right_foot: p(16),
    left_hip: leftHip,
    left_knee: p(13),
    left_foot: p(15),
  };
}

export function meanConfidence(keypoints17: readonly Keypoint17[]): number {
  if (keypoints17.length === 0) return 0;
  let sum = 0;
  for (const keypoint of keypoints17) {
    if (Array.isArray(keypoint)) sum += Number(keypoint[2] ?? 1);
    else if ('score' in keypoint || 'confidence' in keypoint) sum += keypoint.score ?? keypoint.confidence ?? 0;
  }
  return sum / keypoints17.length;
}

function midpoint(a: Point, b: Point): Point { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
