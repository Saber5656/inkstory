import Dexie, { type Table } from 'dexie';

import type {
  Book,
  Character,
  Drawing,
  Page,
  Settings,
} from '../domain/types';
import type { PersistedBlobRecord } from './blobPersistence';

/**
 * IndexedDB migration policy: add a new `version(n).stores(...).upgrade(...)`
 * for additive changes. Existing schemaVersion fields are never mutated in place.
 */
export class InkstoryDatabase extends Dexie {
  blobs!: Table<PersistedBlobRecord, string>;
  drawings!: Table<Drawing, string>;
  characters!: Table<Character, string>;
  books!: Table<Book, string>;
  pages!: Table<Page, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('inkstory');
    this.version(1).stores({
      blobs: 'id, createdAt',
      drawings: 'id, createdAt',
      characters: 'id, createdAt, updatedAt, name',
      books: 'id, createdAt, updatedAt, title',
      pages: 'id, bookId, updatedAt',
      settings: 'key',
    });
  }
}

export const db = new InkstoryDatabase();
export const inkstoryDb = db;
export const inkstoryDB = db;
