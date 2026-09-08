import { describe, expect, it } from 'vitest';
import { nextStep, previousStep } from './machine';
describe('creation wizard', () => {
  it('keeps corrections available and skips humanoid joints for cutouts', () => {
    expect(nextStep('capture', 'humanoid')).toBe('crop');
    expect(nextStep('rigType', 'cutout')).toBe('preview');
    expect(previousStep('preview', 'cutout')).toBe('rigType');
    expect(nextStep('rigType', 'humanoid')).toBe('joints');
    expect(previousStep('preview', 'humanoid')).toBe('joints');
    expect(nextStep('saved', 'humanoid')).toBe('saved');
  });
});
