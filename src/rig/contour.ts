import type { ContourPoint } from './types.ts';

export function extractContour(mask: Uint8Array, width: number, height: number): ContourPoint[] {
  if (mask.length !== width * height) return [];
  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let largest: number[] = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] === 0 || visited[start] !== 0) continue;
    let head = 0; let tail = 0; queue[tail++] = start; visited[start] = 1;
    const component: number[] = [];
    const visit = (index: number) => { if (mask[index] !== 0 && visited[index] === 0) { visited[index] = 1; queue[tail++] = index; } };
    while (head < tail) {
      const index = queue[head++]!; component.push(index); const x = index % width; const y = Math.floor(index / width);
      if (x > 0) visit(index - 1); if (x + 1 < width) visit(index + 1); if (y > 0) visit(index - width); if (y + 1 < height) visit(index + width);
    }
    if (component.length > largest.length) largest = component;
  }
  const largestSet = new Uint8Array(mask.length); for (const index of largest) largestSet[index] = 255;
  const candidates: ContourPoint[] = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if ((largestSet[y * width + x] ?? 0) === 0) continue;
    if (x === 0 || x + 1 === width || y === 0 || y + 1 === height ||
      largestSet[y * width + x - 1] === 0 || largestSet[y * width + x + 1] === 0 ||
      largestSet[(y - 1) * width + x] === 0 || largestSet[(y + 1) * width + x] === 0) candidates.push({ x, y });
  }
  if (candidates.length < 3) return candidates;
  let cx = 0; let cy = 0;
  for (const point of candidates) { cx += point.x; cy += point.y; }
  cx /= candidates.length; cy /= candidates.length;
  candidates.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  const epsilon = Math.hypot(width, height) / 300;
  let result = simplifyClosed(candidates, epsilon);
  let currentEpsilon = epsilon;
  for (let i = 0; i < 8 && result.length > 400; i += 1) { currentEpsilon *= 1.7; result = simplifyClosed(candidates, currentEpsilon); }
  for (let i = 0; i < 8 && result.length < 80 && currentEpsilon > 0.1; i += 1) { currentEpsilon /= 1.7; result = simplifyClosed(candidates, currentEpsilon); }
  return result;
}

export function polygonArea(points: readonly ContourPoint[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) { const a = points[i]!; const b = points[(i + 1) % points.length]!; area += a.x * b.y - b.x * a.y; }
  return Math.abs(area / 2);
}

function simplifyClosed(points: readonly ContourPoint[], epsilon: number): ContourPoint[] {
  if (points.length <= 3) return [...points];
  const open = [...points, points[0]!];
  const simplified = douglasPeucker(open, epsilon);
  if (simplified.length > 1 && samePoint(simplified[0]!, simplified[simplified.length - 1]!)) simplified.pop();
  return simplified;
}

function douglasPeucker(points: readonly ContourPoint[], epsilon: number): ContourPoint[] {
  if (points.length <= 2) return [...points];
  let maxDistance = epsilon; let index = -1;
  const first = points[0]!; const last = points[points.length - 1]!;
  for (let i = 1; i < points.length - 1; i += 1) { const distance = pointLineDistance(points[i]!, first, last); if (distance > maxDistance) { index = i; maxDistance = distance; } }
  if (index < 0) return [first, last];
  return [...douglasPeucker(points.slice(0, index + 1), epsilon).slice(0, -1), ...douglasPeucker(points.slice(index), epsilon)];
}

function pointLineDistance(point: ContourPoint, first: ContourPoint, last: ContourPoint): number {
  const dx = last.x - first.x; const dy = last.y - first.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - first.x, point.y - first.y);
  const t = Math.max(0, Math.min(1, ((point.x - first.x) * dx + (point.y - first.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (first.x + t * dx), point.y - (first.y + t * dy));
}
function samePoint(a: ContourPoint, b: ContourPoint): boolean { return a.x === b.x && a.y === b.y; }
