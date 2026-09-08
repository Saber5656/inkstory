import { describe, expect, it } from 'vitest';
import { suggestMotions } from './suggestMotions';
const clips = [
  {
    id: 'jump',
    keywords: {
      ja: ['じゃんぷ', 'ジャンプ', 'とぶ', '跳ぶ'],
      en: ['jump', 'leap'],
    },
  },
  {
    id: 'run',
    keywords: { ja: ['はしって', 'はしる', '走る'], en: ['run', 'running'] },
  },
  {
    id: 'wave',
    keywords: { ja: ['こんにちは', 'バイバイ'], en: ['hello', 'bye'] },
  },
];
describe('story matched movement', () => {
  it.each([
    'じゃんぷ！',
    'ジャンプ！',
    'とぶ',
    '跳ぶ',
    '大きくじゃんぷ',
    '空へジャンプ',
    '鳥がとぶ',
    '高く跳ぶ',
    'じゃんぷしよう',
    'ジャンプするよ',
    'とぶよ',
    '跳ぶんだ',
  ])('suggests jump for %s', (text) =>
    expect(suggestMotions(text, 'ja', clips)[0]).toBe('jump'),
  );
  it.each([
    'jump',
    'JUMP!',
    'a leap',
    'ＪＵＭＰ',
    'jump up',
    'leap high',
    'the jump.',
    'A LEAP!',
  ])('matches English words %s', (text) =>
    expect(suggestMotions(text, 'en', clips)[0]).toBe('jump'),
  );
  it('does not match word fragments and has a deterministic fallback', () => {
    expect(suggestMotions('jumper', 'en', clips)).toEqual(['idle_breathe']);
    expect(suggestMotions('', 'ja', clips)).toEqual(['idle_breathe']);
    expect(suggestMotions('はしって いったよ', 'ja', clips)).toEqual(['run']);
  });
});
