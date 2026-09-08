import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MotionClipSchema } from './types';

describe('Japanese motion catalog keywords', () => {
  it('includes child-language kana, kanji, and inflected forms', () => {
    const read = (id: string) =>
      MotionClipSchema.parse(
        JSON.parse(readFileSync(`public/motions/${id}.json`, 'utf8')),
      );
    expect(read('jump').keywords.ja).toEqual(
      expect.arrayContaining(['じゃんぷ', '跳ぶ', '飛んで']),
    );
    expect(read('run').keywords.ja).toEqual(
      expect.arrayContaining(['はしって', '走って', '駆けて']),
    );
    expect(read('walk').keywords.ja).toEqual(
      expect.arrayContaining(['あるいて', '歩いて', 'お散歩']),
    );
  });
});
