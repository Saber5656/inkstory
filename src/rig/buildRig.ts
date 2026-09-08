import type { JointMap, JointName } from '../pose/mapping.ts';
import { extractContour } from './contour.ts';
import { buildMesh, maskBounds } from './mesh.ts';
import { computeWeights } from './weights.ts';
import type { CharacterRig, RigJointTuples } from './types.ts';

/** Build a normalized LBS rig from a binary mask and user-confirmed joint positions. */
export function buildRig(mask: Uint8Array, width: number, height: number, joints: JointMap): CharacterRig {
  if (mask.length !== width * height) throw new Error('Mask dimensions do not match width/height');
  const bounds = maskBounds(mask, width, height) ?? { x: 0, y: 0, width: Math.max(1, width), height: Math.max(1, height) };
  const contour = extractContour(mask, width, height);
  const mesh = buildMesh(mask, width, height, contour);
  const origin = joints.root;
  const scale = 1 / Math.max(1, bounds.height);
  const normalizedVertices = mesh.vertices.map((point) => ({ x: (point.x - origin.x) * scale, y: (point.y - origin.y) * scale }));
  const normalizedJoints = {} as RigJointTuples;
  for (const name of Object.keys(joints) as JointName[]) normalizedJoints[name] = [(joints[name].x - origin.x) * scale, (joints[name].y - origin.y) * scale];
  const weightJoints = {} as JointMap;
  for (const name of Object.keys(normalizedJoints) as JointName[]) { const [x, y] = normalizedJoints[name]; weightJoints[name] = { x, y }; }
  const weights = computeWeights(normalizedVertices, weightJoints, Math.hypot(bounds.width, bounds.height) * scale);
  const vertices: number[] = [];
  for (const point of normalizedVertices) vertices.push(point.x, point.y);
  return {
    schemaVersion: 1,
    joints: normalizedJoints,
    mesh: { vertices, triangles: mesh.triangles },
    weights,
    meshMethod: mesh.method,
    textureSize: [width, height],
  };
}
