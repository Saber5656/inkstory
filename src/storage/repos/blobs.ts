import { BlobRecordSchema } from '../../domain/schemas';
import { newId } from '../../domain/ids';
import type { BlobRecord } from '../../domain/types';
import { db } from '../db';
import { decodeBlobRecord, encodeBlobRecord } from '../blobPersistence';
import { StorageCorruptionError } from '../errors';
import { deleteWithQuota } from './helpers';
import { withQuotaHandling } from '../quota';

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
    const parsed = BlobRecordSchema.parse({
      id,
      mime,
      data: data as Blob,
      size: data.size,
      createdAt: Date.now(),
    });
    await withQuotaHandling(async () =>
      db.blobs.put(await encodeBlobRecord(parsed)),
    );
    return id;
  },
  async get(id: string): Promise<BlobRecord | undefined> {
    const raw = await db.blobs.get(id);
    if (raw === undefined) return undefined;
    try {
      return decodeBlobRecord(raw);
    } catch (error) {
      throw new StorageCorruptionError('blob', id, error);
    }
  },
  async list(): Promise<BlobRecord[]> {
    return (await db.blobs.orderBy('createdAt').toArray()).map((row) => {
      try {
        return decodeBlobRecord(row);
      } catch (error) {
        throw new StorageCorruptionError('blob', row.id, error);
      }
    });
  },
  delete: (id: string): Promise<void> => deleteWithQuota(db.blobs, id),
  async getUrl(id: string): Promise<BlobUrlHandle | undefined> {
    const record = await blobsRepo.get(id);
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
