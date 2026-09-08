import { DrawingSchema } from '../../domain/schemas';
import type { Drawing } from '../../domain/types';
import { db } from '../db';
import { deleteWithQuota, readValidated, writeValidated } from './helpers';

export const drawingsRepo = {
  put: (drawing: Drawing): Promise<Drawing> =>
    writeValidated(db.drawings, DrawingSchema, drawing, 'drawing'),
  get: (id: string): Promise<Drawing | undefined> =>
    readValidated(db.drawings, DrawingSchema, id, 'drawing'),
  list: async (): Promise<Drawing[]> =>
    Promise.all(
      (await db.drawings.orderBy('createdAt').toArray()).map(
        (row) =>
          readValidated(
            db.drawings,
            DrawingSchema,
            row.id,
            'drawing',
          ) as Promise<Drawing>,
      ),
    ),
  delete: (id: string): Promise<void> => deleteWithQuota(db.drawings, id),
};
