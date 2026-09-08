import {
  BONE_IDS,
  MotionClipSchema,
  type BoneId,
  type MotionClip,
  type MotionSample,
} from './types';

export function shortestArcDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

export function lerpAngle(from: number, to: number, amount: number): number {
  return from + shortestArcDelta(from, to) * amount;
}

export function sampleMotion(
  clip: MotionClip,
  tMs: number,
  speed = 1,
  loop = clip.loop,
): MotionSample {
  if (!Number.isFinite(tMs)) throw new RangeError('tMs must be finite');
  if (!Number.isFinite(speed) || speed < 0.5 || speed > 2)
    throw new RangeError('speed must be between 0.5 and 2');
  const count = clip.frameCount;
  const sourceFrame = (Math.max(0, tMs) * speed * clip.fps) / 1000;
  const position = loop
    ? sourceFrame % count
    : Math.min(sourceFrame, count - 1);
  const first = Math.floor(position);
  const amount = position - first;
  const second = loop ? (first + 1) % count : Math.min(first + 1, count - 1);
  const angles = {} as Record<BoneId, number>;
  for (const bone of BONE_IDS) {
    const frameValues = clip.frames as unknown as Record<BoneId, number[]>;
    const values = frameValues[bone];
    const fallback =
      (clip.restAngles as unknown as Record<BoneId, number>)[bone] ?? 0;
    const a = values?.[first] ?? fallback;
    const b = values?.[second] ?? a;
    angles[bone] = lerpAngle(a, b, amount);
  }
  const rootA = clip.rootTranslation[first] ?? [0, 0];
  const rootB = clip.rootTranslation[second] ?? rootA;
  return {
    angles,
    rootT: [
      rootA[0] + (rootB[0] - rootA[0]) * amount,
      rootA[1] + (rootB[1] - rootA[1]) * amount,
    ],
    frame: position,
  };
}

export class MotionPlayer {
  private clip: MotionClip;
  private elapsedMs = 0;
  private playing = false;
  private speed = 1;
  private once: boolean;
  private readonly onceOverride?: boolean;

  constructor(
    clip: MotionClip,
    options: { speed?: number; once?: boolean } = {},
  ) {
    const parsed = MotionClipSchema.parse(clip);
    this.clip = parsed;
    this.onceOverride = options.once;
    this.once = options.once ?? !parsed.loop;
    this.setSpeed(options.speed ?? 1);
  }

  setClip(clip: MotionClip): void {
    this.clip = MotionClipSchema.parse(clip);
    this.once = this.onceOverride ?? !this.clip.loop;
    this.elapsedMs = 0;
  }
  setSpeed(speed: number): void {
    if (speed < 0.5 || speed > 2)
      throw new RangeError('speed must be between 0.5 and 2');
    this.speed = speed;
  }
  play(): void {
    this.playing = true;
  }
  pause(): void {
    this.playing = false;
  }
  seek(tMs: number): void {
    this.elapsedMs = Math.max(0, tMs);
  }
  get isPlaying(): boolean {
    return this.playing;
  }
  get timeMs(): number {
    return this.elapsedMs;
  }
  get currentClip(): MotionClip {
    return this.clip;
  }

  tick(dtMs: number): MotionSample {
    if (this.playing)
      this.elapsedMs = Math.max(0, this.elapsedMs + Math.max(0, dtMs));
    const sample = sampleMotion(
      this.clip,
      this.elapsedMs,
      this.speed,
      this.once ? false : this.clip.loop,
    );
    if (
      this.once &&
      this.elapsedMs >= ((this.clip.frameCount - 1) * 1000) / this.clip.fps
    )
      this.playing = false;
    return sample;
  }
  sample(): MotionSample {
    return sampleMotion(
      this.clip,
      this.elapsedMs,
      this.speed,
      this.once ? false : this.clip.loop,
    );
  }
}
