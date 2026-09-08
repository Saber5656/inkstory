import { clampIntensity, type Particle } from './types';

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PARTICLE_CAP = 120;

export class ParticlePool {
  readonly particles: Particle[];
  constructor(readonly capacity = PARTICLE_CAP) {
    this.particles = Array.from({ length: capacity }, () => ({
      x: 0,
      y: 0,
      size: 0,
      alpha: 0,
      rotation: 0,
    }));
  }
  update(
    id: 'sparkles' | 'confetti' | 'bubbles',
    tMs: number,
    intensity: number,
    seed: number,
  ): number {
    const count = Math.min(
      this.capacity,
      Math.floor(12 + clampIntensity(intensity) * 108),
    );
    const random = mulberry32(seed ^ Math.floor(tMs / 180));
    for (let i = 0; i < this.capacity; i += 1) {
      const particle = this.particles[i]!;
      if (i >= count) {
        particle.alpha = 0;
        continue;
      }
      const phase = (tMs / (id === 'bubbles' ? 3000 : 2200) + random()) % 1;
      particle.x = random() * 2 - 1;
      particle.y = id === 'bubbles' ? 1 - phase * 2 : phase * 2 - 1;
      particle.size = 0.008 + random() * 0.022;
      particle.alpha = Math.sin(Math.PI * phase) * (0.4 + random() * 0.6);
      particle.rotation = random() * Math.PI * 2;
    }
    return count;
  }
}

export function sampleParticles(
  id: 'sparkles' | 'confetti' | 'bubbles',
  tMs: number,
  intensity: number,
  seed: number,
): Particle[] {
  const pool = new ParticlePool();
  const count = pool.update(id, tMs, intensity, seed);
  return pool.particles.slice(0, count).map((particle) => ({ ...particle }));
}
