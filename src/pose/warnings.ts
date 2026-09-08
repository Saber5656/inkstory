import type { JointMap, JointName } from './mapping';
export function jointWarnings(
  joints: JointMap,
  mask: Uint8Array,
  width: number,
  height: number,
): Array<{ joint: JointName; reason: 'outside' | 'crossed' }> {
  const warnings: Array<{ joint: JointName; reason: 'outside' | 'crossed' }> =
    [];
  for (const joint of Object.keys(joints) as JointName[]) {
    const p = joints[joint],
      x = Math.round(p.x),
      y = Math.round(p.y);
    if (x < 0 || y < 0 || x >= width || y >= height || !mask[y * width + x])
      warnings.push({ joint, reason: 'outside' });
    if (
      (joint.startsWith('right_') && p.x > joints.torso.x) ||
      (joint.startsWith('left_') && p.x < joints.torso.x)
    )
      warnings.push({ joint, reason: 'crossed' });
  }
  return warnings;
}
