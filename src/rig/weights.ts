import type { JointMap, Point } from '../pose/mapping.ts';
import { BONE_EDGES, BONE_NAMES, type RigWeight } from './types.ts';

export function computeWeights(vertices: readonly Point[], joints: JointMap, bboxDiagonal: number): RigWeight[][] {
  const epsilon = Math.max(1e-6, bboxDiagonal / 1000);
  return vertices.map((vertex) => {
    const distances = BONE_EDGES.map(([parent, child], boneIndex) => ({ boneIndex, distance: pointSegmentDistance(vertex, joints[parent], joints[child]) }));
    distances.sort((a, b) => a.distance - b.distance || a.boneIndex - b.boneIndex);
    const neck = joints.neck;
    const closest = distances[0]!;
    if (vertex.y < neck.y && (closest.boneIndex === BONE_NAMES.indexOf('neck') || pointDistance(vertex, neck) < closest.distance * 0.8)) return [{ boneIndex: BONE_NAMES.indexOf('neck'), w: 1 }];
    const first = distances[0]!; const second = distances[1] ?? first;
    const firstWeight = 1 / (first.distance + epsilon) ** 4;
    const secondWeight = second.boneIndex === first.boneIndex ? 0 : 1 / (second.distance + epsilon) ** 4;
    const total = firstWeight + secondWeight || 1;
    return secondWeight === 0
      ? [{ boneIndex: first.boneIndex, w: 1 }]
      : [{ boneIndex: first.boneIndex, w: firstWeight / total }, { boneIndex: second.boneIndex, w: secondWeight / total }];
  });
}

export function pointSegmentDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x; const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return pointDistance(point, start);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - start.x - t * dx, point.y - start.y - t * dy);
}
function pointDistance(a: Point, b: Point): number { return Math.hypot(a.x - b.x, a.y - b.y); }
