export const JOINTS = [
  { name: 'root', parent: null },
  { name: 'hip', parent: 'root' },
  { name: 'torso', parent: 'hip' },
  { name: 'neck', parent: 'torso' },
  { name: 'right_shoulder', parent: 'torso' },
  { name: 'right_elbow', parent: 'right_shoulder' },
  { name: 'right_hand', parent: 'right_elbow' },
  { name: 'left_shoulder', parent: 'torso' },
  { name: 'left_elbow', parent: 'left_shoulder' },
  { name: 'left_hand', parent: 'left_elbow' },
  { name: 'right_hip', parent: 'root' },
  { name: 'right_knee', parent: 'right_hip' },
  { name: 'right_foot', parent: 'right_knee' },
  { name: 'left_hip', parent: 'root' },
  { name: 'left_knee', parent: 'left_hip' },
  { name: 'left_foot', parent: 'left_knee' },
] as const;

export type JointName = (typeof JOINTS)[number]['name'];
export const JOINT_NAMES = JOINTS.map(({ name }) => name) as [
  JointName,
  ...JointName[],
];
export type JointParent = (typeof JOINTS)[number]['parent'];

export const BONE_IDS = JOINTS.slice(1).map(({ name }) => name) as [
  Exclude<JointName, 'root'>,
  ...Exclude<JointName, 'root'>[],
];
export type BoneId = (typeof BONE_IDS)[number];

const parentByJoint = new Map<JointName, JointName | null>(
  JOINTS.map((joint) => [joint.name, joint.parent]),
);

/** Returns bone ids in the canonical parent-first traversal order. */
export function boneChain(root: JointName = 'root'): BoneId[] {
  const result: BoneId[] = [];
  const visit = (parent: JointName): void => {
    for (const joint of JOINTS) {
      if (joint.parent === parent) {
        result.push(joint.name);
        visit(joint.name);
      }
    }
  };
  if (parentByJoint.has(root)) visit(root);
  return result;
}

export function parentJoint(joint: JointName): JointName | null {
  return parentByJoint.get(joint) ?? null;
}
