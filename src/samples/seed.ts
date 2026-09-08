import { settingsRepo } from '@/storage/repos/settings';
import { saveSampleRecords } from '@/storage/seed';
import type { Page } from '@/domain/types';
import {
  imagePixels,
  prepareTexture,
  buildCharacterRecords,
  segmentAsync,
} from '@/app/wizard/pipeline';
import { templateJoints } from '@/pose/template';
import i18n from '@/i18n/setup';
let seeding: Promise<void> | undefined;
export function ensureSamples(
  locale: 'ja' | 'en',
  restore = false,
): Promise<void> {
  if (seeding)
    return restore ? seeding.then(() => ensureSamples(locale, true)) : seeding;
  seeding = (async () => {
    if (!restore && (await settingsRepo.get('samples.seeded'))?.value) return;
    const image = new Image();
    image.src = `${import.meta.env.BASE_URL}samples/ink.png`;
    await image.decode();
    const bitmap = await createImageBitmap(image);
    const drawing = imagePixels(bitmap);
    bitmap.close();
    const segmented = await segmentAsync(drawing);
    const texture = await prepareTexture(drawing, segmented.mask);
    const joints = templateJoints({
      x: 0,
      y: 0,
      width: texture.image.width,
      height: texture.image.height,
    });
    const records = await buildCharacterRecords({
      name: i18n.t('sampleName', { lng: locale }),
      source: 'file',
      drawing,
      texture: texture.blob,
      textureImage: texture.image,
      mask: texture.mask,
      joints,
      rigType: 'humanoid',
    });
    const { character } = records;
    const now = Date.now();
    const book = {
      id: crypto.randomUUID(),
      title: i18n.t('sampleTitle', { lng: locale }),
      createdAt: now,
      updatedAt: now,
      pageOrder: [] as string[],
    };
    const pages: Page[] = [];
    const backgrounds = ['meadow', 'sky', 'night'];
    const motions = ['wave', 'jump', 'sit_down'];
    for (let index = 0; index < 3; index++) {
      pages.push({
        id: crypto.randomUUID(),
        bookId: book.id,
        characterId: character.id,
        backgroundId: backgrounds[index] ?? 'meadow',
        text: i18n.t(`samplePage${index + 1}`, { lng: locale }),
        motionId: motions[index] ?? 'wave',
        effectIds: [],
        advance: 'auto',
        createdAt: now,
        updatedAt: now,
      });
    }
    book.pageOrder = pages.map((page) => page.id);
    await saveSampleRecords({ ...records, book, pages }, restore);
  })().finally(() => {
    seeding = undefined;
  });
  return seeding;
}
