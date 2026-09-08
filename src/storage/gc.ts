import { parseOrThrow } from '../domain/parse';
import {
  BlobRecordSchema,
  CharacterSchema,
  DrawingSchema,
  PageSchema,
} from '../domain/schemas';
import { db } from './db';
import { decodeBlobRecord } from './blobPersistence';
import { StorageCorruptionError } from './errors';
import { withQuotaHandling } from './quota';

function parseStored<T>(
  schema: Parameters<typeof parseOrThrow>[0],
  row: unknown,
  entity: string,
  id: string,
): T {
  try {
    return parseOrThrow(schema, row, entity) as T;
  } catch (error) {
    throw new StorageCorruptionError(entity, id, error);
  }
}

async function sweepInTransaction(): Promise<string[]> {
  const referenced = new Set<string>();
  for (const row of await db.drawings.toArray())
    referenced.add(
      parseStored<{ imageBlobId: string }>(
        DrawingSchema,
        row,
        'drawing',
        row.id,
      ).imageBlobId,
    );
  for (const row of await db.characters.toArray()) {
    const character = parseStored<{
      textureBlobId: string;
      thumbBlobId: string;
    }>(CharacterSchema, row, 'character', row.id);
    referenced.add(character.textureBlobId);
    referenced.add(character.thumbBlobId);
  }
  for (const row of await db.pages.toArray()) {
    const page = parseStored<{ narrationBlobId?: string }>(
      PageSchema,
      row,
      'page',
      row.id,
    );
    if (page.narrationBlobId) referenced.add(page.narrationBlobId);
  }
  const removed: string[] = [];
  for (const row of await db.blobs.toArray()) {
    const blob = parseStored<{ id: string }>(
      BlobRecordSchema,
      decodeBlobRecord(row),
      'blob',
      row.id,
    );
    if (!referenced.has(blob.id)) {
      await db.blobs.delete(blob.id);
      removed.push(blob.id);
    }
  }
  return removed;
}

export const gc = {
  sweep: async (): Promise<string[]> =>
    withQuotaHandling(() =>
      db.transaction(
        'rw',
        [db.blobs, db.drawings, db.characters, db.pages, db.books, db.settings],
        sweepInTransaction,
      ),
    ),
  sweepInTransaction,
};
