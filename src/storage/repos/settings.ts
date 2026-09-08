import { SettingsSchema } from '../../domain/schemas';
import type { Settings } from '../../domain/types';
import { db } from '../db';
import { StorageCorruptionError } from '../errors';
import { deleteWithQuota, readValidated, writeValidated } from './helpers';

export const settingsRepo = {
  async get(key: string): Promise<Settings | undefined> {
    const value = await db.settings.get(key);
    if (value === undefined) return undefined;
    try {
      return SettingsSchema.parse(value);
    } catch (error) {
      throw new StorageCorruptionError('setting', key, error);
    }
  },
  set: (key: string, value: unknown): Promise<Settings> =>
    writeValidated(db.settings, SettingsSchema, { key, value }, 'setting'),
  list: async (): Promise<Settings[]> =>
    Promise.all(
      (await db.settings.toArray()).map(
        (row) =>
          readValidated(
            db.settings,
            SettingsSchema,
            row.key,
            'setting',
          ) as Promise<Settings>,
      ),
    ),
  delete: (key: string): Promise<void> => deleteWithQuota(db.settings, key),
};
