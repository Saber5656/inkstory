import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MotionClipSchema, MotionIndexSchema } from './types';

describe('bundled motion library', () => {
  it('contains ten schema-valid clips with matching checksums', () => {
    const index = MotionIndexSchema.parse(JSON.parse(readFileSync('public/motions/index.json', 'utf8')));
    expect(index).toHaveLength(10);
    for (const entry of index) MotionClipSchema.parse(JSON.parse(readFileSync(`public${entry.file}`, 'utf8')));
  });
});
