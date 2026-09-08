import { Texture } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { CharacterActor } from './CharacterActor';

describe('character actor ownership', () => {
  it('destroys an owned decoded texture while preserving shared textures', () => {
    const actor = new CharacterActor({
      textureUrl: '',
      rig: null,
      rigType: 'cutout',
    });
    const texture = new Texture();
    const destroy = vi.spyOn(texture, 'destroy');
    actor.setTexture(texture, true);
    actor.destroy({ children: true });
    expect(destroy).toHaveBeenCalledWith(true);
  });

  it('does not destroy a shared public texture', () => {
    const actor = new CharacterActor({
      textureUrl: '',
      rig: null,
      rigType: 'cutout',
    });
    const texture = new Texture();
    const destroy = vi.spyOn(texture, 'destroy');
    actor.setTexture(texture);
    actor.destroy({ children: true });
    expect(destroy).not.toHaveBeenCalled();
  });

  it('hides the placeholder until an image texture is available', () => {
    const actor = new CharacterActor({
      textureUrl: '',
      rig: null,
      rigType: 'cutout',
    });
    expect(actor.visible).toBe(false);
    actor.setTexture(Texture.WHITE);
    expect(actor.visible).toBe(true);
  });
});
