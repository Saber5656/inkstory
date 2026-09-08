import { clampIntensity, type EffectConfig, type EffectDelta } from './types';

const TAU = Math.PI * 2;
const empty = (): EffectDelta => ({ position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 }, staticSparkle: false });

export function applyTransform(id: 'float' | 'wiggle' | 'bounce' | 'drift' | 'spin', tMs: number, config: EffectConfig): EffectDelta {
  const out = empty();
  const intensity = config.reducedMotion ? 0 : clampIntensity(config.intensity);
  if (intensity === 0) return out;
  switch (id) {
    case 'float': out.position.y = Math.sin(tMs * TAU / 2400) * (0.02 + intensity * 0.04); break;
    case 'wiggle': out.rotation = Math.sin(tMs * TAU / 900) * (2 + intensity * 6); break;
    case 'bounce': { const amount = Math.abs(Math.sin(tMs * TAU / 1400)) * (0.03 + intensity * 0.07); out.scale.y = 1 - amount; out.scale.x = 1 / out.scale.y; break; }
    case 'drift': out.position.x = Math.sin(tMs * TAU / 5200) * (0.03 + intensity * 0.07) * (config.stageWidth ?? 1); break;
    case 'spin': out.rotation = tMs / 1000 * (15 + intensity * 45); break;
  }
  return out;
}
