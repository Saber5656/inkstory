import type { Table } from 'dexie';
import { parseOrThrow } from '../../domain/parse';
import type { z } from 'zod';
import { StorageCorruptionError } from '../errors';
import { withQuotaHandling } from '../quota';

export async function readValidated<T extends z.ZodTypeAny>(
  table: Table<unknown, string>,
  schema: T,
  id: string,
  entity: string,
): Promise<z.infer<T> | undefined> {
  const raw = await table.get(id);
  if (raw === undefined) return undefined;
  try {
    return parseOrThrow(schema, raw, entity);
  } catch (error) {
    throw new StorageCorruptionError(entity, id, error);
  }
}

export async function writeValidated<T extends z.ZodTypeAny>(
  table: Table<unknown, string>,
  schema: T,
  value: unknown,
  entity: string,
): Promise<z.infer<T>> {
  const parsed = parseOrThrow(schema, value, entity);
  await withQuotaHandling(() => table.put(parsed));
  return parsed;
}

export async function deleteWithQuota(
  table: Table<unknown, string>,
  id: string,
): Promise<void> {
  await withQuotaHandling(() => table.delete(id));
}
