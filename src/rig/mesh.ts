import cdt2d from 'cdt2d';
import type { ContourPoint } from './types.ts';

export interface MeshResult {
  vertices: ContourPoint[];
  triangles: number[];
  method: 'cdt' | 'grid';
}

export function buildMesh(
  mask: Uint8Array,
  width: number,
  height: number,
  contour: readonly ContourPoint[],
): MeshResult {
  const bbox = maskBounds(mask, width, height);
  if (!bbox || contour.length < 3) return gridMesh(mask, width, height, bbox);
  const spacing = Math.max(1, Math.hypot(bbox.width, bbox.height) / 40);
  const vertices = contour.map((point) => ({ ...point }));
  for (let y = bbox.y + 1; y < bbox.y + bbox.height; y += spacing)
    for (let x = bbox.x + 1; x < bbox.x + bbox.width; x += spacing) {
      const ix = Math.round(x);
      const iy = Math.round(y);
      if (strictlyInside(mask, width, height, ix, iy)) vertices.push({ x, y });
    }
  const edges: [number, number][] = contour.map((_, index) => [
    index,
    (index + 1) % contour.length,
  ]);
  try {
    const raw = cdt2d(
      vertices.map((point) => [point.x, point.y]),
      edges,
      { exterior: false },
    );
    const triangles: number[] = [];
    for (const triangle of raw) {
      if (triangle.length !== 3) continue;
      const a = vertices[triangle[0]!];
      const b = vertices[triangle[1]!];
      const c = vertices[triangle[2]!];
      if (!a || !b || !c || Math.abs(cross(a, b, c)) < 1e-7) continue;
      if (
        strictlyInsideOrBoundary(
          mask,
          width,
          height,
          (a.x + b.x + c.x) / 3,
          (a.y + b.y + c.y) / 3,
        )
      )
        triangles.push(triangle[0]!, triangle[1]!, triangle[2]!);
    }
    if (triangles.length >= 3 && isManifold(triangles))
      return { vertices, triangles, method: 'cdt' };
  } catch {
    /* malformed contours intentionally use the deterministic fallback */
  }
  return gridMesh(mask, width, height, bbox);
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function maskBounds(
  mask: Uint8Array,
  width: number,
  height: number,
): Bounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1)
      if ((mask[y * width + x] ?? 0) !== 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
  return maxX < 0
    ? null
    : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function gridMesh(
  mask: Uint8Array,
  width: number,
  height: number,
  bbox: Bounds | null,
): MeshResult {
  if (!bbox) return { vertices: [], triangles: [], method: 'grid' };
  let spacing = Math.max(1, Math.hypot(bbox.width, bbox.height) / 40);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const vertices: ContourPoint[] = [];
    const index = new Map<string, number>();
    const triangles: number[] = [];
    const get = (x: number, y: number) => {
      const key = `${x},${y}`;
      const existing = index.get(key);
      if (existing !== undefined) return existing;
      const value = vertices.length;
      vertices.push({ x, y });
      index.set(key, value);
      return value;
    };
    for (let y = bbox.y; y < bbox.y + bbox.height; y += spacing)
      for (let x = bbox.x; x < bbox.x + bbox.width; x += spacing) {
        const x1 = Math.min(bbox.x + bbox.width, x + spacing);
        const y1 = Math.min(bbox.y + bbox.height, y + spacing);
        if (
          !strictlyInsideOrBoundary(
            mask,
            width,
            height,
            (x + x1) / 2,
            (y + y1) / 2,
          )
        )
          continue;
        const a = get(x, y);
        const b = get(x1, y);
        const c = get(x1, y1);
        const d = get(x, y1);
        triangles.push(a, b, c, a, c, d);
      }
    if (vertices.length <= 3000 || attempt === 1)
      return {
        vertices,
        triangles: triangles.filter((value) => value < vertices.length),
        method: 'grid',
      };
    spacing *= 1.5;
  }
  return { vertices: [], triangles: [], method: 'grid' };
}

function strictlyInside(
  mask: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): boolean {
  if (x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1) return false;
  const index = y * width + x;
  return (
    mask[index] !== 0 &&
    mask[index - 1] !== 0 &&
    mask[index + 1] !== 0 &&
    mask[index - width] !== 0 &&
    mask[index + width] !== 0
  );
}
function strictlyInsideOrBoundary(
  mask: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): boolean {
  const ix = Math.max(0, Math.min(width - 1, Math.floor(x)));
  const iy = Math.max(0, Math.min(height - 1, Math.floor(y)));
  return mask[iy * width + ix] !== 0;
}
function cross(a: ContourPoint, b: ContourPoint, c: ContourPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
function isManifold(triangles: readonly number[]): boolean {
  const edges = new Map<string, number>();
  for (let i = 0; i < triangles.length; i += 3) {
    const pairs: [number, number][] = [
      [triangles[i]!, triangles[i + 1]!],
      [triangles[i + 1]!, triangles[i + 2]!],
      [triangles[i + 2]!, triangles[i]!],
    ];
    for (const [a, b] of pairs) {
      const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  return [...edges.values()].every((count) => count <= 2);
}
