import { z } from 'zod';

export const idSchema = z.string().uuid();
export const uuidSchema = idSchema;
export type EntityId = z.infer<typeof idSchema>;

export function newId(): EntityId {
  return crypto.randomUUID();
}

export const createId = newId;
