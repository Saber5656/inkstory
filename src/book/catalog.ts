import idle from '../../public/motions/idle_breathe.json';
import wave from '../../public/motions/wave.json';
import walk from '../../public/motions/walk.json';
import run from '../../public/motions/run.json';
import jump from '../../public/motions/jump.json';
import dance1 from '../../public/motions/dance_1.json';
import dance2 from '../../public/motions/dance_2.json';
import spin from '../../public/motions/spin.json';
import sit from '../../public/motions/sit_down.json';
import cheer from '../../public/motions/cheer.json';
export const motionCatalog = [
  idle,
  wave,
  walk,
  run,
  jump,
  dance1,
  dance2,
  spin,
  sit,
  cheer,
].map(({ id, name, keywords, category }) => ({ id, name, keywords, category }));
export const backgrounds = [
  'plain_cream',
  'meadow',
  'forest',
  'sky',
  'night',
  'ocean',
  'space',
  'city',
  'rainbow',
  'plain_blue',
  'plain_pink',
  'plain_lilac',
] as const;
