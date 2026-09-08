import { describe, expect, it } from 'vitest';
import { composeEffects, sampleParticles } from './index';

describe('procedural effects', () => {
  it('is deterministic for the same time and seed', () => {
    expect(sampleParticles('sparkles', 5000, 0.8, 42)).toEqual(sampleParticles('sparkles', 5000, 0.8, 42));
    expect(composeEffects(['float'], 600, { intensity: 1, seed: 2 }, 'cutout').position.y).toBeCloseTo(0.06);
  });
  it('gates transforms and particles for reduced motion', () => {
    const result = composeEffects(['wiggle', 'sparkles'], 500, { intensity: 1, seed: 2, reducedMotion: true }, 'humanoid');
    expect(result.rotation).toBe(0);
    expect(result.particles).toHaveLength(0);
    expect(result.staticSparkle).toBe(true);
  });
});
