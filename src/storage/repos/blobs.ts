import { BlobRecordSchema } from '../../domain/schemas';
import { newId } from '../../domain/ids';
import type { BlobRecord } from '../../domain/types';
import { db } from '../db';
import { deleteWithQuota, readValidated, writeValidated } from './helpers';

export interface BlobUrlHandle {
  readonly url: string;
  release: () => void;
}
export interface BlobInput {
  readonly size: number;
  readonly type: string;
}

export const blobsRepo = {
  async put(mime: string, data: BlobInput): Promise<string> {
    const id = newId();
    await writeValidated(
      db.blobs,
      BlobRecordSchema,
      { id, mime, data: data as Blob, size: data.size, createdAt: Date.now() },
      'blob',
    );
    return id;
  },
  get: (id: string): Promise<BlobRecord | undefined> =>
    readValidated(db.blobs, BlobRecordSchema, id, 'blob'),
  list: async (): Promise<BlobRecord[]> =>
    Promise.all(
      (await db.blobs.orderBy('createdAt').toArray()).map(async (row) => {
        const value = await readValidated(
          db.blobs,
          BlobRecordSchema,
          row.id,
          'blob',
        );
        return value as BlobRecord;
      }),
    ),
  delete: (id: string): Promise<void> => deleteWithQuota(db.blobs, id),
  async getUrl(id: string): Promise<BlobUrlHandle | undefined> {
    const record = await readValidated(db.blobs, BlobRecordSchema, id, 'blob');
    if (!record) return undefined;
    const url = URL.createObjectURL(record.data);
    let released = false;
    return {
      url,
      release: () => {
        if (!released) {
          URL.revokeObjectURL(url);
          released = true;
        }
      },
    };
  },
};
