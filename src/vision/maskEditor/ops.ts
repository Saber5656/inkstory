// Pure mask operations are kept separate from the eventual canvas component so
// worker and UI code share identical brush/history/texture behavior.
export { applyBrush, MaskHistory } from '../mask.ts';
export { toTexture } from '../texture.ts';
export type { BrushMode, BrushOptions } from '../mask.ts';
export type { TextureBBox, TextureResult } from '../texture.ts';
