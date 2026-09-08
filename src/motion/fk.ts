import {
  BONE_IDS,
  JOINT_IDS,
  type BoneId,
  type JointId,
  type Vec2,
} from './types';

export type Affine2D = {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
};
export type RestJoints = Partial<Record<JointId, Vec2>> & { root: Vec2 };
export type FKResult = {
  joints: Record<JointId, Vec2>;
  matrices: Record<BoneId, Affine2D>;
  restAngles: Record<BoneId, number>;
  lengths: Record<BoneId, number>;
};

export const BONE_PARENT: Record<BoneId, JointId> = {
  hip: 'root',
  torso: 'hip',
  neck: 'torso',
  right_shoulder: 'torso',
  right_elbow: 'right_shoulder',
  right_hand: 'right_elbow',
  left_shoulder: 'torso',
  left_elbow: 'left_shoulder',
  left_hand: 'left_elbow',
  right_hip: 'root',
  right_knee: 'right_hip',
  right_foot: 'right_knee',
  left_hip: 'root',
  left_knee: 'left_hip',
  left_foot: 'left_knee',
};

const deg = Math.PI / 180;
const childOf = (bone: BoneId): JointId => bone;
const point = (v: Vec2): Vec2 => [v[0], v[1]];

function angleBetween(a: Vec2, b: Vec2): number {
  return Math.atan2(b[1] - a[1], b[0] - a[0]) / deg;
}

export function calculateRest(rest: RestJoints): {
  restAngles: Record<BoneId, number>;
  lengths: Record<BoneId, number>;
} {
  const restAngles = {} as Record<BoneId, number>;
  const lengths = {} as Record<BoneId, number>;
  for (const bone of BONE_IDS) {
    const parent = rest[BONE_PARENT[bone]] ?? rest.root;
    const child = rest[childOf(bone)] ?? parent;
    restAngles[bone] = angleBetween(parent, child);
    lengths[bone] = Math.hypot(child[0] - parent[0], child[1] - parent[1]);
  }
  return { restAngles, lengths };
}

export function forwardKinematics(
  rest: RestJoints,
  angles: Partial<Record<BoneId, number>>,
  rootT: Vec2 = [0, 0],
): FKResult {
  const calculated = calculateRest(rest);
  const joints = {} as Record<JointId, Vec2>;
  for (const id of JOINT_IDS) joints[id] = point(rest[id] ?? rest.root);
  joints.root = [rest.root[0] + rootT[0], rest.root[1] + rootT[1]];
  const matrices = {} as Record<BoneId, Affine2D>;
  for (const bone of BONE_IDS) {
    const parentId = BONE_PARENT[bone];
    const parentRest = rest[parentId] ?? rest.root;
    const childRest = rest[bone] ?? parentRest;
    const parentAnimated = joints[parentId];
    const parentAngle = angles[bone] ?? calculated.restAngles[bone];
    const length = calculated.lengths[bone];
    const radians = parentAngle * deg;
    const childAnimated: Vec2 = [
      parentAnimated[0] + Math.cos(radians) * length,
      parentAnimated[1] + Math.sin(radians) * length,
    ];
    joints[bone] = childAnimated;
    const cos = Math.cos(radians - calculated.restAngles[bone] * deg);
    const sin = Math.sin(radians - calculated.restAngles[bone] * deg);
    matrices[bone] = {
      a: cos,
      b: sin,
      c: -sin,
      d: cos,
      tx: parentAnimated[0] - (cos * parentRest[0] - sin * parentRest[1]),
      ty: parentAnimated[1] - (sin * parentRest[0] + cos * parentRest[1]),
    };
    // Keep the matrix anchored at the animated parent while preserving the rest-space child chain.
    void childRest;
  }
  return {
    joints,
    matrices,
    restAngles: calculated.restAngles,
    lengths: calculated.lengths,
  };
}
