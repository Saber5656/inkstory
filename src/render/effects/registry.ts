import { applyTransform } from './transforms';
import { ParticlePool } from './particles';
import {
  clampIntensity,
  isReducedMotion,
  type EffectConfig,
  type EffectDelta,
  type EffectId,
  type Particle,
  type RigType,
} from './types';

export type EffectDefinition = {
  id: EffectId;
  name: { ja: string; en: string };
  kind: 'transform' | 'particles';
  allowedRigTypes: RigType[];
  defaultIntensity: number;
};
export const EFFECTS: readonly EffectDefinition[] = [
  {
    id: 'float',
    name: { ja: 'ふわふわ', en: 'Float' },
    kind: 'transform',
    allowedRigTypes: ['humanoid', 'cutout'],
    defaultIntensity: 0.4,
  },
  {
    id: 'wiggle',
    name: { ja: 'ゆらゆら', en: 'Wiggle' },
    kind: 'transform',
    allowedRigTypes: ['humanoid', 'cutout'],
    defaultIntensity: 0.5,
  },
  {
    id: 'bounce',
    name: { ja: 'ぽよん', en: 'Bounce' },
    kind: 'transform',
    allowedRigTypes: ['humanoid', 'cutout'],
    defaultIntensity: 0.5,
  },
  {
    id: 'drift',
    name: { ja: 'ただよう', en: 'Drift' },
    kind: 'transform',
    allowedRigTypes: ['humanoid', 'cutout'],
    defaultIntensity: 0.4,
  },
  {
    id: 'spin',
    name: { ja: 'くるくる', en: 'Spin' },
    kind: 'transform',
    allowedRigTypes: ['cutout'],
    defaultIntensity: 0.4,
  },
  {
    id: 'sparkles',
    name: { ja: 'きらきら', en: 'Sparkles' },
    kind: 'particles',
    allowedRigTypes: ['humanoid', 'cutout'],
    defaultIntensity: 0.6,
  },
  {
    id: 'confetti',
    name: { ja: '紙ふぶき', en: 'Confetti' },
    kind: 'particles',
    allowedRigTypes: ['humanoid', 'cutout'],
    defaultIntensity: 0.6,
  },
  {
    id: 'bubbles',
    name: { ja: 'しゃぼん玉', en: 'Bubbles' },
    kind: 'particles',
    allowedRigTypes: ['humanoid', 'cutout'],
    defaultIntensity: 0.5,
  },
];

export const getEffect = (id: string): EffectDefinition | undefined =>
  EFFECTS.find((effect) => effect.id === id);

export class EffectRuntime {
  readonly pool = new ParticlePool();
  readonly result: Omit<EffectDelta, 'staticSparkle'> & {
    particles: Particle[];
    staticSparkle: boolean;
  } = {
    position: { x: 0, y: 0 },
    rotation: 0,
    particles: [],
    scale: { x: 1, y: 1 },
    staticSparkle: false,
  };
  update(
    ids: readonly EffectId[],
    tMs: number,
    config: EffectConfig,
    rigType: RigType,
  ) {
    const out = this.result;
    out.position.x = 0;
    out.position.y = 0;
    out.rotation = 0;
    out.scale.x = 1;
    out.scale.y = 1;
    out.particles.length = 0;
    out.staticSparkle = false;
    const reduced = isReducedMotion(config.reducedMotion);
    const useDefaultFloat = ids.length === 0 && rigType === 'cutout';
    const count = useDefaultFloat ? 1 : Math.min(3, ids.length);
    for (let index = 0; index < count; index += 1) {
      const id = useDefaultFloat ? 'float' : ids[index];
      if (!id) continue;
      const definition = getEffect(id);
      if (!definition || !definition.allowedRigTypes.includes(rigType))
        continue;
      if (definition.kind === 'transform') {
        const delta = applyTransform(
          id as 'float' | 'wiggle' | 'bounce' | 'drift' | 'spin',
          tMs,
          {
            ...config,
            intensity: useDefaultFloat ? 0.4 : clampIntensity(config.intensity),
            reducedMotion: reduced,
          },
        );
        out.position.x += delta.position.x;
        out.position.y += delta.position.y;
        out.rotation += delta.rotation;
        out.scale.x *= delta.scale.x;
        out.scale.y *= delta.scale.y;
      } else if (!reduced) {
        const particleCount = this.pool.update(
          id as 'sparkles' | 'confetti' | 'bubbles',
          tMs,
          config.intensity,
          config.seed + index,
        );
        for (
          let particleIndex = 0;
          particleIndex < particleCount;
          particleIndex += 1
        )
          out.particles.push(this.pool.particles[particleIndex]!);
      }
      if (reduced && definition.kind === 'particles') out.staticSparkle = true;
    }
    return out;
  }
}

export function composeEffects(
  ids: readonly EffectId[],
  tMs: number,
  config: EffectConfig,
  rigType: RigType,
): Omit<EffectDelta, 'staticSparkle'> & {
  particles: Particle[];
  staticSparkle: boolean;
} {
  return new EffectRuntime().update(ids, tMs, config, rigType);
}

export * from './types';
export * from './transforms';
export * from './particles';
