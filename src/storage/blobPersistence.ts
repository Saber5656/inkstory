import { BlobRecordSchema } from '../domain/schemas';
import type { BlobRecord } from '../domain/types';

/**
 * WebKit can reject Blob values while preparing an IndexedDB write. Keep the
 * durable representation transferable and reconstruct a Blob at the API
 * boundary. Blob values remain the only values exposed by the repository.
 */
export type PersistedBlobRecord = Omit<BlobRecord, 'data'> & {
  data: Blob | ArrayBuffer;
};

async function blobBytes(data: Blob): Promise<ArrayBuffer> {
  if (typeof data.arrayBuffer === 'function') return data.arrayBuffer();
  if (typeof FileReader !== 'undefined')
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () =>
        reject(reader.error ?? new Error('blob read failed'));
      reader.readAsArrayBuffer(data);
    });
  throw new Error('blob bytes unavailable');
}

function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return (
    !!value &&
    typeof value === 'object' &&
    Object.prototype.toString.call(value) === '[object ArrayBuffer]' &&
    typeof (value as ArrayBuffer).byteLength === 'number'
  );
}

export async function encodeBlobRecord(
  record: BlobRecord,
): Promise<PersistedBlobRecord> {
  return {
    ...record,
    data: await blobBytes(record.data),
  };
}

export function decodeBlobRecord(raw: unknown): BlobRecord {
  if (!raw || typeof raw !== 'object') return BlobRecordSchema.parse(raw);

  const candidate = raw as Record<string, unknown>;
  if (!isArrayBuffer(candidate.data)) return BlobRecordSchema.parse(raw);
  const bytes = candidate.data;

  const data = new Blob([bytes], {
    type: typeof candidate.mime === 'string' ? candidate.mime : '',
  });
  // jsdom's Blob implementation does not expose arrayBuffer yet. Keep the
  // same repository contract in that environment while native browsers use
  // their built-in implementation.
  if (typeof data.arrayBuffer !== 'function')
    Object.defineProperty(data, 'arrayBuffer', {
      configurable: true,
      value: () => Promise.resolve(bytes.slice(0)),
    });
  if (candidate.size !== data.size)
    throw new Error('persisted blob size does not match its data');
  return BlobRecordSchema.parse({ ...candidate, data });
}
