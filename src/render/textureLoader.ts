import { Assets, Texture } from 'pixi.js';

type ImageResource = HTMLImageElement & { decode?: () => Promise<void> };
export type CharacterTextureLoaderOptions = {
  createImage?: () => ImageResource;
  createTexture?: (image: ImageResource) => Texture;
  loadAssets?: (url: string) => Promise<Texture>;
};

const isInlineImage = (url: string): boolean =>
  /^(blob:|data:)/.test(url);

async function decodeImage(image: ImageResource): Promise<void> {
  if (typeof image.decode === 'function') {
    await image.decode();
    return;
  }
  if (image.complete) return;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('character texture failed to load'));
  });
}

/** Load persisted object URLs through Image so Pixi's extension resolver is bypassed. */
export async function loadCharacterTexture(
  url: string,
  options: CharacterTextureLoaderOptions = {},
): Promise<Texture> {
  const loadAssets = options.loadAssets ?? ((source) => Assets.load<Texture>(source));
  if (!isInlineImage(url)) return loadAssets(url);
  const image = (options.createImage ?? (() => new Image()))();
  image.src = url;
  await decodeImage(image);
  return (options.createTexture ?? ((source) => Texture.from(source)))(image);
}
