import type { JointMap, JointName, Point } from './mapping.ts';

export interface MaskBBox { x: number; y: number; width: number; height: number; }

/** Prefill for the no-model path. Right side means character right (viewer-left). */
export function templateJoints(bbox: MaskBBox): JointMap {
  const fractions: Record<JointName, [number, number]> = {
    neck: [0.50, 0.18], torso: [0.50, 0.38], hip: [0.50, 0.55], root: [0.50, 0.57],
    right_shoulder: [0.35, 0.22], right_elbow: [0.22, 0.35], right_hand: [0.15, 0.50],
    left_shoulder: [0.65, 0.22], left_elbow: [0.78, 0.35], left_hand: [0.85, 0.50],
    right_hip: [0.42, 0.57], right_knee: [0.40, 0.75], right_foot: [0.39, 0.93],
    left_hip: [0.58, 0.57], left_knee: [0.60, 0.75], left_foot: [0.61, 0.93],
  };
  const joints = {} as JointMap;
  for (const name of Object.keys(fractions) as JointName[]) {
    const [x, y] = fractions[name];
    joints[name] = { x: bbox.x + x * bbox.width, y: bbox.y + y * bbox.height };
  }
  return joints;
}

export const templatePose = templateJoints;
export type Joints16 = JointMap;
export function cloneJoints(joints: JointMap): JointMap {
  const copy = {} as JointMap;
  for (const name of Object.keys(joints) as JointName[]) { const point: Point = joints[name]; copy[name] = { ...point }; }
  return copy;
}
