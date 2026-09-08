import type { JointName, Point } from '../pose/mapping.ts';

export type RigJointTuples = { [name in JointName]: [number, number] };

export interface RigWeight {
  boneIndex: number;
  w: number;
}
export interface CharacterRig {
  schemaVersion: 1;
  joints: RigJointTuples;
  mesh: { vertices: number[]; triangles: number[]; uvs?: number[] };
  weights: RigWeight[][];
  meshMethod: 'cdt' | 'grid';
  textureSize: [number, number];
}
export const BONE_NAMES = [
  'hip',
  'torso',
  'neck',
  'right_shoulder',
  'right_elbow',
  'right_hand',
  'left_shoulder',
  'left_elbow',
  'left_hand',
  'right_hip',
  'right_knee',
  'right_foot',
  'left_hip',
  'left_knee',
  'left_foot',
] as const;
export type BoneName = (typeof BONE_NAMES)[number];
export const BONE_EDGES: readonly [JointName, JointName][] = [
  ['root', 'hip'],
  ['hip', 'torso'],
  ['torso', 'neck'],
  ['torso', 'right_shoulder'],
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_hand'],
  ['torso', 'left_shoulder'],
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_hand'],
  ['root', 'right_hip'],
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_foot'],
  ['root', 'left_hip'],
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_foot'],
];
export type ContourPoint = Point;
