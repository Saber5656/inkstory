import type { Book } from '../domain/types';

export class StorageCorruptionError extends Error {
  readonly entity: string;
  readonly id?: string;
  readonly cause: unknown;

  constructor(entity: string, id: string | undefined, cause: unknown) {
    super(`Corrupt ${entity}${id ? ` (${id})` : ''}`);
    this.name = 'StorageCorruptionError';
    this.entity = entity;
    this.id = id;
    this.cause = cause;
  }
}

export class CharacterInUseError extends Error {
  readonly bookTitles: string[];
  readonly bookIds: string[];

  constructor(books: Pick<Book, 'id' | 'title'>[]) {
    super(`Character is used by ${books.map((book) => book.title).join(', ')}`);
    this.name = 'CharacterInUseError';
    this.bookTitles = books.map((book) => book.title);
    this.bookIds = books.map((book) => book.id);
  }
}

export class InvalidPageOrderError extends Error {
  readonly bookId: string;
  constructor(
    bookId: string,
    message = 'Page order must contain each page exactly once',
  ) {
    super(message);
    this.name = 'InvalidPageOrderError';
    this.bookId = bookId;
  }
}
