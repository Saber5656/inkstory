import { describe, expect, it, vi } from 'vitest';
import { loadCharacterTexture } from './textureLoader';

describe('character texture loading', () => {
  it('decodes blob URLs before creating a Pixi texture', async () => {
    const decode = vi.fn().mockResolvedValue(undefined);
    const image = {
      src: '',
      decode,
    } as unknown as HTMLImageElement;
    const texture = {} as never;
    const createTexture = vi.fn().mockReturnValue(texture);
    const loadAssets = vi.fn();

    await expect(
      loadCharacterTexture('blob:http://localhost/ink', {
        createImage: () => image,
        createTexture,
        loadAssets,
      }),
    ).resolves.toBe(texture);

    expect(image.src).toBe('blob:http://localhost/ink');
    expect(decode).toHaveBeenCalledOnce();
    expect(createTexture).toHaveBeenCalledWith(image);
    expect(loadAssets).not.toHaveBeenCalled();
  });

  it('uses Pixi asset loading for extension-backed public URLs', async () => {
    const texture = {} as never;
    const loadAssets = vi.fn().mockResolvedValue(texture);
    await expect(
      loadCharacterTexture('/samples/ink.png', {
        createImage: () => {
          throw new Error('public URL should use Assets');
        },
        createTexture: vi.fn(),
        loadAssets,
      }),
    ).resolves.toBe(texture);
    expect(loadAssets).toHaveBeenCalledWith('/samples/ink.png');
  });
});
