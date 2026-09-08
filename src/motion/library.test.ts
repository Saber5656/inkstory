import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MotionClipSchema, MotionIndexSchema } from './types';

describe('bundled motion library', () => {
  it('contains ten schema-valid clips with matching checksums', () => {
    const index = MotionIndexSchema.parse(
      JSON.parse(readFileSync('public/motions/index.json', 'utf8')),
    );
    expect(index).toHaveLength(10);
    for (const entry of index) {
      const file = readFileSync(`public${entry.file}`);
      const source = readFileSync(`assets-src${entry.file}`);
      MotionClipSchema.parse(JSON.parse(file.toString('utf8')));
      MotionClipSchema.parse(JSON.parse(source.toString('utf8')));
      expect(file).toEqual(source);
      expect(createHash('sha256').update(file).digest('hex')).toBe(
        entry.sha256,
      );
    }
  });

  it('keeps every looping clip within the four-degree seam tolerance', () => {
    const index = MotionIndexSchema.parse(
      JSON.parse(readFileSync('public/motions/index.json', 'utf8')),
    );
    for (const entry of index) {
      const clip = MotionClipSchema.parse(
        JSON.parse(readFileSync(`public${entry.file}`, 'utf8')),
      );
      if (!clip.loop) continue;
      for (const values of Object.values(clip.frames)) {
        const from = values[0]!;
        const to = values[values.length - 1]!;
        const shortest = Math.abs(((to - from + 540) % 360) - 180);
        expect(shortest, `${clip.id} seam`).toBeLessThanOrEqual(4);
      }
    }
  });
});
