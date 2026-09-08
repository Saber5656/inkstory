import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { DestroyOptions } from 'pixi.js';
import {
  BONE_IDS,
  MotionPlayer,
  calculateRest,
  shortestArcDelta,
  type BoneId,
  type MotionClip,
} from '../motion';
import { forwardKinematics, type RestJoints } from '../motion/fk';
import {
  EffectRuntime,
  isReducedMotion,
  type EffectId,
  type RigType,
} from './effects/registry';
import { SkinnedMesh, type SkinRig } from './SkinnedMesh';
import { capMotionSpeed } from './reducedMotion';

export function retargetMotionAngles(
  clipRestAngles: Partial<Record<BoneId, number>>,
  characterRestAngles: Partial<Record<BoneId, number>>,
  motionAngles: Partial<Record<BoneId, number>>,
): Record<BoneId, number> {
  return Object.fromEntries(
    BONE_IDS.map((bone) => {
      const clipRest = clipRestAngles[bone] ?? 0;
      const characterRest = characterRestAngles[bone] ?? clipRest;
      const motion = motionAngles[bone] ?? clipRest;
      return [bone, characterRest + shortestArcDelta(clipRest, motion)];
    }),
  ) as Record<BoneId, number>;
}

export type CharacterActorOptions = {
  textureUrl: string;
  rig: (SkinRig & { joints?: RestJoints }) | null;
  rigType: RigType;
  clips?: Record<string, MotionClip>;
  motionId?: string;
  effectIds?: EffectId[];
  seed?: number;
  speed?: number;
  playing?: boolean;
  reducedMotion?: boolean;
};

const defaultRest: RestJoints = {
  root: [0, 0],
  hip: [0, -0.14],
  torso: [0, -0.34],
  neck: [0, -0.49],
  right_shoulder: [0.16, -0.45],
  right_elbow: [0.25, -0.3],
  right_hand: [0.3, -0.12],
  left_shoulder: [-0.16, -0.45],
  left_elbow: [-0.25, -0.3],
  left_hand: [-0.3, -0.12],
  right_hip: [0.08, -0.12],
  right_knee: [0.1, 0.16],
  right_foot: [0.12, 0.42],
  left_hip: [-0.08, -0.12],
  left_knee: [-0.1, 0.16],
  left_foot: [-0.12, 0.42],
};

export class CharacterActor extends Container {
  private readonly options: CharacterActorOptions;
  private readonly clips: Record<string, MotionClip>;
  private readonly player: MotionPlayer;
  private readonly mesh: SkinnedMesh | null;
  private readonly sprite: Sprite | null;
  private readonly rest: RestJoints;
  private readonly restAngles: Record<BoneId, number>;
  private effectIds: EffectId[];
  private seed: number;
  private readonly effectRuntime = new EffectRuntime();
  private readonly particleSprites: Sprite[] = [];
  private readonly sparkle: Graphics;
  private displaySize = 1;
  private baseScale = 1;
  private requestedSpeed = 1;
  private stageX = 0;
  private stageY = 0;
  private reducedMotion: boolean;
  private elapsedMs = 0;
  private ownedTexture: Texture | null = null;

  constructor(options: CharacterActorOptions) {
    super();
    this.options = options;
    this.clips = options.clips ?? {};
    const initial = options.motionId
      ? this.clips[options.motionId]
      : Object.values(this.clips)[0];
    const clip = initial ?? makeIdleClip();
    this.reducedMotion = options.reducedMotion ?? isReducedMotion();
    this.requestedSpeed = options.speed ?? 1;
    this.player = new MotionPlayer(clip, {
      speed: capMotionSpeed(this.requestedSpeed, this.reducedMotion),
    });
    this.effectIds = options.effectIds ?? [];
    this.seed = options.seed ?? 1;
    this.rest = options.rig?.joints ?? defaultRest;
    this.restAngles = calculateRest(this.rest).restAngles;
    const texture = Texture.WHITE;
    if (options.rigType === 'humanoid' && options.rig) {
      this.mesh = new SkinnedMesh(options.rig, texture);
      this.sprite = null;
      this.addChild(this.mesh);
    } else {
      this.mesh = null;
      this.sprite = new Sprite(texture);
      this.sprite.anchor.set(0.5, 0.5);
      this.addChild(this.sprite);
    }
    this.visible = Boolean(options.textureUrl);
    if (options.playing) this.player.play();
    const particleLayer = new Container();
    for (let index = 0; index < 120; index += 1) {
      const particle = new Sprite(Texture.WHITE);
      particle.anchor.set(0.5);
      particle.visible = false;
      this.particleSprites.push(particle);
      particleLayer.addChild(particle);
    }
    this.sparkle = new Graphics().circle(0, 0, 0.035).fill('#fff3a3');
    this.sparkle.visible = false;
    particleLayer.addChild(this.sparkle);
    this.addChild(particleLayer);
  }

  setClip(id: string): void {
    const clip = this.clips[id];
    if (clip) this.player.setClip(clip);
  }
  setMotionClip(clip: MotionClip): void {
    this.player.setClip(clip);
  }
  setTexture(texture: Texture, owned = false): void {
    if (this.ownedTexture && this.ownedTexture !== texture) {
      this.ownedTexture.destroy(true);
    }
    this.ownedTexture = owned ? texture : null;
    this.visible = true;
    if (this.mesh) this.mesh.texture = texture;
    if (this.sprite) {
      this.sprite.texture = texture;
      this.baseScale =
        this.displaySize / Math.max(1, texture.width, texture.height);
    }
  }
  fitToSize(size: number): void {
    this.displaySize = size;
    this.baseScale = this.mesh
      ? size
      : size /
        Math.max(
          1,
          this.sprite?.texture.width ?? 1,
          this.sprite?.texture.height ?? 1,
        );
    this.scale.set(this.baseScale);
  }
  setStagePosition(x: number, y: number): void {
    this.stageX = x;
    this.stageY = y;
    this.position.set(x, y);
  }
  setSpeed(speed: number): void {
    this.requestedSpeed = speed;
    this.player.setSpeed(capMotionSpeed(speed, this.reducedMotion));
  }
  setEffects(effectIds: EffectId[], seed = this.seed): void {
    this.effectIds = effectIds.slice(0, 3);
    this.seed = seed;
  }
  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    this.player.setSpeed(
      capMotionSpeed(this.requestedSpeed, this.reducedMotion),
    );
  }
  play(): void {
    this.player.play();
  }
  pause(): void {
    this.player.pause();
  }

  override destroy(options?: DestroyOptions): void {
    const ownedTexture = this.ownedTexture;
    this.ownedTexture = null;
    super.destroy(options ?? { children: true });
    if (ownedTexture && !ownedTexture.destroyed) ownedTexture.destroy(true);
  }

  tick(dtMs: number): void {
    this.elapsedMs += Math.max(0, dtMs);
    const sample = this.player.tick(dtMs);
    const angles = retargetMotionAngles(
      this.player.currentClip.restAngles,
      this.restAngles,
      sample.angles,
    );
    const fk = forwardKinematics(this.rest, angles, sample.rootT);
    if (this.mesh) {
      const matrices = BONE_IDS.map((bone) => fk.matrices[bone]);
      this.mesh.updateSkin(matrices);
    }
    const effects = this.effectRuntime.update(
      this.effectIds,
      this.elapsedMs,
      { intensity: 1, seed: this.seed, reducedMotion: this.reducedMotion },
      this.options.rigType,
    );
    this.position.set(
      this.stageX + effects.position.x * this.displaySize,
      this.stageY + effects.position.y * this.displaySize,
    );
    this.rotation = (effects.rotation * Math.PI) / 180;
    this.scale.set(
      this.baseScale * effects.scale.x,
      this.baseScale * effects.scale.y,
    );
    for (let index = 0; index < this.particleSprites.length; index += 1) {
      const particle = this.particleSprites[index]!;
      const value = effects.particles[index];
      particle.visible = value !== undefined;
      if (value) {
        particle.position.set(
          value.x * this.displaySize,
          value.y * this.displaySize,
        );
        particle.scale.set(value.size * this.displaySize);
        particle.alpha = value.alpha;
        particle.rotation = value.rotation;
      }
    }
    this.sparkle.visible = effects.staticSparkle;
  }
}

function makeIdleClip(): MotionClip {
  const frames = [0, 1, 0, -1, 0];
  const angles = Object.fromEntries(
    BONE_IDS.map((bone) => [bone, frames]),
  ) as Record<string, number[]>;
  const restAngles = Object.fromEntries(
    BONE_IDS.map((bone) => [bone, 0]),
  ) as Record<string, number>;
  return {
    schemaVersion: 1,
    id: 'idle_breathe',
    name: { ja: 'いき', en: 'Idle' },
    keywords: { ja: ['まつ', 'やすむ'], en: ['idle', 'wait'] },
    category: 'idle',
    fps: 30,
    frameCount: frames.length,
    loop: true,
    rootTranslation: frames.map(() => [0, 0] as [number, number]),
    restAngles,
    frames: angles,
  } as unknown as MotionClip;
}
