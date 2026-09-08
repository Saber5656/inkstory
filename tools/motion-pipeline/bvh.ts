import { BONE_IDS, MotionClipSchema, type BoneId, type MotionCategory, type MotionClip, type Vec2 } from '../../src/motion';

type Axis = 'X' | 'Y' | 'Z';
type Channel = `${Axis}position` | `${Axis}rotation`;
type BvhNode = { name: string; offset: Vec3; channels: Channel[]; children: BvhNode[] };
type Vec3 = [number, number, number];
type Mat3 = [number, number, number, number, number, number, number, number, number];
export type MotionConfig = { id: string; name: { ja: string; en: string }; keywords: { ja: string[]; en: string[] }; category: MotionCategory; jointMap: Partial<Record<string, string>>; fps?: number; plane?: 'xy' | 'xz' | 'yz'; loop?: boolean; restFrame?: number; startFrame?: number; endFrame?: number; maxAngle?: number };
export type ParsedBvh = { root: BvhNode; frameCount: number; frameTime: number; frames: number[][] };

const identity: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const mul = (a: Mat3, b: Mat3): Mat3 => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
];
const rotate = (axis: Axis, radians: number): Mat3 => { const c = Math.cos(radians); const s = Math.sin(radians); if (axis === 'X') return [1, 0, 0, 0, c, -s, 0, s, c]; if (axis === 'Y') return [c, 0, s, 0, 1, 0, -s, 0, c]; return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const transform = (m: Mat3, p: Vec3): Vec3 => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2], m[3] * p[0] + m[4] * p[1] + m[5] * p[2], m[6] * p[0] + m[7] * p[1] + m[8] * p[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export function parseBvh(text: string): ParsedBvh {
  const tokens = text.replace(/\r/g, '').trim().split(/\s+/);
  let cursor = 0;
  const expect = (value: string): void => { if (tokens[cursor] !== value) throw new Error(`Expected ${value}, got ${tokens[cursor] ?? 'EOF'}`); cursor += 1; };
  expect('HIERARCHY'); expect('ROOT'); const rootName = tokens[cursor++]!;
  const parseNode = (name: string): BvhNode => {
    expect('{');
    const node: BvhNode = { name, offset: [0, 0, 0], channels: [], children: [] };
    while (tokens[cursor] !== '}') {
      const token = tokens[cursor++];
      if (token === 'OFFSET') node.offset = [Number(tokens[cursor++] ?? 0), Number(tokens[cursor++] ?? 0), Number(tokens[cursor++] ?? 0)];
      else if (token === 'CHANNELS') { const count = Number(tokens[cursor++]); node.channels = tokens.slice(cursor, cursor + count) as Channel[]; cursor += count; }
      else if (token === 'JOINT') { const childName = tokens[cursor++]!; node.children.push(parseNode(childName)); }
      else if (token === 'End') { expect('Site'); expect('{'); expect('OFFSET'); cursor += 3; expect('}'); }
      else throw new Error(`Unsupported BVH token ${token}`);
    }
    expect('}'); return node;
  };
  // parseNode expects the node name to have already been consumed by ROOT.
  const root = parseNode(rootName);
  expect('MOTION'); expect('Frames:'); const frameCount = Number(tokens[cursor++]); expect('Frame'); expect('Time:'); const frameTime = Number(tokens[cursor++]);
  const channels = countChannels(root); const frames: number[][] = [];
  for (let frame = 0; frame < frameCount; frame += 1) { const values = tokens.slice(cursor, cursor + channels).map(Number); cursor += channels; if (values.length !== channels || values.some((value) => !Number.isFinite(value))) throw new Error(`Invalid BVH frame ${frame}`); frames.push(values); }
  return { root, frameCount, frameTime, frames };
}

function countChannels(node: BvhNode): number { return node.channels.length + node.children.reduce((sum, child) => sum + countChannels(child), 0); }

function framePositions(root: BvhNode, values: number[]): Map<string, Vec3> {
  const positions = new Map<string, Vec3>(); let cursor = 0;
  const visit = (node: BvhNode, parentPosition: Vec3, parentRotation: Mat3): void => {
    let localRotation = identity; let position = add(parentPosition, transform(parentRotation, node.offset));
    for (const channel of node.channels) { const value = values[cursor++] ?? 0; const axis = channel[0] as Axis; if (channel.endsWith('position')) { const offset: Vec3 = axis === 'X' ? [value, 0, 0] : axis === 'Y' ? [0, value, 0] : [0, 0, value]; position = add(position, transform(parentRotation, offset)); } else localRotation = mul(localRotation, rotate(axis, value * Math.PI / 180)); }
    const worldRotation = mul(parentRotation, localRotation); positions.set(node.name, position); for (const child of node.children) visit(child, position, worldRotation);
  };
  visit(root, [0, 0, 0], identity); return positions;
}

function project(point: Vec3, plane: MotionConfig['plane']): Vec2 { if (plane === 'xz') return [point[0], point[2]]; if (plane === 'yz') return [point[1], point[2]]; return [point[0], point[1]]; }
function round4(value: number): number { const rounded = Math.round(value * 10000) / 10000; return Object.is(rounded, -0) ? 0 : rounded; }
export function clampRelativeAngle(value: number, rest: number, limit: number): number {
  const delta = ((value - rest + 540) % 360) - 180;
  return round4(rest + Math.max(-limit, Math.min(limit, delta)));
}

export function convertBvh(text: string, config: MotionConfig): MotionClip {
  const parsed = parseBvh(text); const plane = config.plane ?? 'xy'; const sourceFps = 1 / parsed.frameTime; const first = Math.max(0, config.startFrame ?? 0); const last = Math.min(parsed.frameCount - 1, config.endFrame ?? parsed.frameCount - 1); if (last < first) throw new Error('BVH frame range is empty');
  const positions = Array.from({ length: last - first + 1 }, (_, index) => framePositions(parsed.root, parsed.frames[first + index]!));
  const names = Object.values(config.jointMap).filter((name): name is string => name !== undefined); const restPositions = positions[Math.min(config.restFrame ?? 0, positions.length - 1)]!;
  const heightPoints = names.map((name) => restPositions.get(name)).filter((point): point is Vec3 => point !== undefined); const ys = heightPoints.map((point) => project(point, plane)[1]); const height = Math.max(1, Math.max(...ys) - Math.min(...ys));
  const sourceAngles = Object.fromEntries(BONE_IDS.map((bone) => [bone, [] as number[]])) as Record<BoneId, number[]>; const roots: Vec2[] = [];
  const angle = (parent: string | undefined, child: string | undefined, map: Map<string, Vec3>): number => { const a = parent ? map.get(parent) : undefined; const b = child ? map.get(child) : undefined; if (!a || !b) return 0; const pa = project(a, plane); const pb = project(b, plane); return Math.atan2(pb[1] - pa[1], pb[0] - pa[0]) * 180 / Math.PI; };
  const parentNames: Record<BoneId, string> = { hip: 'root', torso: 'hip', neck: 'torso', right_shoulder: 'torso', right_elbow: 'right_shoulder', right_hand: 'right_elbow', left_shoulder: 'torso', left_elbow: 'left_shoulder', left_hand: 'left_elbow', right_hip: 'root', right_knee: 'right_hip', right_foot: 'right_knee', left_hip: 'root', left_knee: 'left_hip', left_foot: 'left_knee' };
  const parentFor = (bone: BoneId): string | undefined => config.jointMap[parentNames[bone]];
  for (const map of positions) { for (const bone of BONE_IDS) sourceAngles[bone].push(angle(parentFor(bone), config.jointMap[bone], map)); const root = map.get(config.jointMap.root ?? parsed.root.name); const startRoot = positions[0]!.get(config.jointMap.root ?? parsed.root.name); roots.push(root && startRoot ? [round4((project(root, plane)[0] - project(startRoot, plane)[0]) / height), round4((project(root, plane)[1] - project(startRoot, plane)[1]) / height)] : [0, 0]); }
  const restAngles = Object.fromEntries(BONE_IDS.map((bone) => [bone, round4(sourceAngles[bone][Math.min(config.restFrame ?? 0, sourceAngles[bone].length - 1)] ?? 0)])) as Record<BoneId, number>;
  const targetFps = config.fps ?? 30; const targetCount = Math.max(1, Math.round((positions.length - 1) / sourceFps * targetFps) + 1); const frames = Object.fromEntries(BONE_IDS.map((bone) => [bone, [] as number[]])) as Record<BoneId, number[]>; const rootTranslation: Vec2[] = [];
  for (let frame = 0; frame < targetCount; frame += 1) { const source = Math.min(positions.length - 1, frame * sourceFps / targetFps); const low = Math.floor(source); const alpha = source - low; for (const bone of BONE_IDS) { const a = sourceAngles[bone][low] ?? restAngles[bone]; const b = sourceAngles[bone][Math.min(low + 1, positions.length - 1)] ?? a; const value = a + ((b - a + 540) % 360 - 180) * alpha; const limit = config.maxAngle ?? 135; frames[bone].push(clampRelativeAngle(value, restAngles[bone] ?? 0, limit)); } const a = roots[low] ?? [0, 0]; const b = roots[Math.min(low + 1, roots.length - 1)] ?? a; rootTranslation.push([round4(a[0] + (b[0] - a[0]) * alpha), round4(a[1] + (b[1] - a[1]) * alpha)]); }
  if (config.loop && targetCount > 2) { const blendStart = Math.floor(targetCount * 0.9); for (const bone of BONE_IDS) for (let i = blendStart; i < targetCount; i += 1) { const amount = (i - blendStart + 1) / Math.max(1, targetCount - blendStart); const values = frames[bone]; values[i] = round4((values[i] ?? 0) * (1 - amount) + (values[0] ?? 0) * amount); } }
  return MotionClipSchema.parse({ schemaVersion: 1, id: config.id, name: config.name, keywords: config.keywords, category: config.category, fps: targetFps, frameCount: targetCount, loop: config.loop ?? true, rootTranslation, restAngles, frames });
}

export function stableMotionJson(clip: MotionClip): string { return `${JSON.stringify(clip, null, 2)}\n`; }
