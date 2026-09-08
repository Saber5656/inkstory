export type EffectId = 'float' | 'wiggle' | 'bounce' | 'drift' | 'spin' | 'sparkles' | 'confetti' | 'bubbles';
export type RigType = 'humanoid' | 'cutout';
export type EffectConfig = { intensity: number; seed: number; stageWidth?: number; reducedMotion?: boolean };
export type EffectTarget = { position: { x: number; y: number }; rotation: number; scale: { x: number; y: number } };
export type EffectDelta = { position: { x: number; y: number }; rotation: number; scale: { x: number; y: number }; staticSparkle: boolean };
export type Particle = { x: number; y: number; size: number; alpha: number; rotation: number };

export function clampIntensity(intensity: number): number { return Math.max(0, Math.min(1, Number.isFinite(intensity) ? intensity : 0)); }

export function isReducedMotion(override = false): boolean {
  if (override) return true;
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
