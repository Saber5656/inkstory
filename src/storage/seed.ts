import { encodeBlobRecord } from './blobPersistence';
import type {
  BlobRecord,
  Drawing,
  Character,
  Book,
  Page,
} from '@/domain/types';
import {
  BlobRecordSchema,
  DrawingSchema,
  CharacterSchema,
  BookSchema,
  PageSchema,
  SettingsSchema,
} from '@/domain/schemas';
import { db } from './db';
import { withQuotaHandling } from './quota';
export async function saveSampleRecords(
  records: {
    drawing: Drawing;
    character: Character;
    blobs: BlobRecord[];
    book: Book;
    pages: Page[];
  },
  restore = false,
): Promise<void> {
  const drawing = DrawingSchema.parse(records.drawing);
  const character = CharacterSchema.parse(records.character);
  const blobs = records.blobs.map((blob) => BlobRecordSchema.parse(blob));
  const book = BookSchema.parse(records.book);
  const pages = records.pages.map((page) => PageSchema.parse(page));
  const persisted = await Promise.all(blobs.map(encodeBlobRecord));
  await withQuotaHandling(() =>
    db.transaction(
      'rw',
      [db.drawings, db.characters, db.blobs, db.books, db.pages, db.settings],
      async () => {
        const seeded = await db.settings.get('samples.seeded');
        if (!restore && seeded && SettingsSchema.parse(seeded).value === true)
          return;
        const row = await db.settings.get('samples.ids');
        const prior = row ? SettingsSchema.parse(row).value : [];
        const ids = Array.isArray(prior)
          ? prior.filter((id): id is string => typeof id === 'string')
          : [];
        await db.blobs.bulkPut(persisted);
        await db.drawings.put(drawing);
        await db.characters.put(character);
        await db.books.put(book);
        await db.pages.bulkPut(pages);
        await db.settings.put({
          key: 'samples.ids',
          value: [...ids, character.id, book.id],
        });
        await db.settings.put({ key: 'samples.seeded', value: true });
      },
    ),
  );
}
