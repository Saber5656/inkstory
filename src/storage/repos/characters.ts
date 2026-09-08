import {
  CharacterSchema,
  PageSchema,
  BookSchema,
  DrawingSchema,
  BlobRecordSchema,
} from '../../domain/schemas';
import { newId } from '../../domain/ids';
import type { BlobRecord, Character, Drawing } from '../../domain/types';
import { parseOrThrow } from '../../domain/parse';
import { db } from '../db';
import { gc } from '../gc';
import { CharacterInUseError, StorageCorruptionError } from '../errors';
import { requestPersistence, withQuotaHandling } from '../quota';
import { readValidated, writeValidated } from './helpers';

export const charactersRepo = {
  async put(character: Character): Promise<Character> {
    const saved = await writeValidated(
      db.characters,
      CharacterSchema,
      character,
      'character',
    );
    await requestPersistence();
    return saved;
  },
  async create(
    input: Omit<Character, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Character> {
    const now = Date.now();
    return charactersRepo.put({
      ...input,
      id: newId(),
      createdAt: now,
      updatedAt: now,
    });
  },
  /** Saves all character-owned rows in one transaction, useful after wizard completion. */
  async saveCharacter(input: {
    drawing: Drawing;
    character: Character;
    blobs?: BlobRecord[];
  }): Promise<Character> {
    const drawing = parseOrThrow(DrawingSchema, input.drawing, 'drawing');
    const character = parseOrThrow(
      CharacterSchema,
      input.character,
      'character',
    );
    const blobs = (input.blobs ?? []).map((blob) =>
      parseOrThrow(BlobRecordSchema, blob, 'blob'),
    );
    await withQuotaHandling(() =>
      db.transaction('rw', [db.blobs, db.drawings, db.characters], async () => {
        for (const blob of blobs) await db.blobs.put(blob);
        await db.drawings.put(drawing);
        await db.characters.put(character);
      }),
    );
    await requestPersistence();
    return character;
  },
  get: (id: string): Promise<Character | undefined> =>
    readValidated(db.characters, CharacterSchema, id, 'character'),
  list: async (): Promise<Character[]> =>
    Promise.all(
      (await db.characters.orderBy('createdAt').toArray()).map(
        (row) =>
          readValidated(
            db.characters,
            CharacterSchema,
            row.id,
            'character',
          ) as Promise<Character>,
      ),
    ),
  listByRecency: async (): Promise<Character[]> =>
    Promise.all(
      (await db.characters.orderBy('updatedAt').reverse().toArray()).map(
        (row) =>
          readValidated(
            db.characters,
            CharacterSchema,
            row.id,
            'character',
          ) as Promise<Character>,
      ),
    ),
  update: (character: Character): Promise<Character> =>
    writeValidated(db.characters, CharacterSchema, character, 'character'),
  async deleteCharacter(id: string): Promise<void> {
    await withQuotaHandling(() =>
      db.transaction(
        'rw',
        [db.characters, db.drawings, db.pages, db.books, db.blobs],
        async () => {
          const references = [];
          for (const rawPage of await db.pages.toArray()) {
            let page;
            try {
              page = PageSchema.parse(rawPage);
            } catch (error) {
              throw new StorageCorruptionError(
                'page',
                String((rawPage as { id?: unknown }).id),
                error,
              );
            }
            if (page.characterId !== id) continue;
            const bookRaw = await db.books.get(page.bookId);
            if (bookRaw) {
              try {
                references.push(BookSchema.parse(bookRaw));
              } catch (error) {
                throw new StorageCorruptionError('book', page.bookId, error);
              }
            }
          }
          const uniqueBooks = [
            ...new Map(references.map((book) => [book.id, book])).values(),
          ];
          if (uniqueBooks.length) throw new CharacterInUseError(uniqueBooks);
          const character = await readValidated(
            db.characters,
            CharacterSchema,
            id,
            'character',
          );
          if (!character) return;
          const drawingRaw = await db.drawings.get(character.drawingId);
          if (drawingRaw) {
            try {
              DrawingSchema.parse(drawingRaw);
            } catch (error) {
              throw new StorageCorruptionError(
                'drawing',
                character.drawingId,
                error,
              );
            }
          }
          await db.characters.delete(id);
          await db.drawings.delete(character.drawingId);
          await gc.sweepInTransaction();
        },
      ),
    );
  },
  delete: (id: string): Promise<void> => charactersRepo.deleteCharacter(id),
};
