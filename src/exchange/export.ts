import pkg from '../../package.json';
import { zipSync, strToU8 } from 'fflate';

import {
  ExportManifestSchema,
  type Character,
  type Page,
} from '../domain/schemas';
import type { BlobRecord } from '../domain/types';
import {
  blobsRepo,
  booksRepo,
  charactersRepo,
  drawingsRepo,
  pagesRepo,
} from '../storage';
import { PortableBookSchema, PortableCharacterSchema } from './bundleSchema';

export interface ExportSelection {
  characterIds?: string[];
  bookIds?: string[];
}

async function blobBytes(
  record: BlobRecord,
  path: string,
): Promise<Uint8Array> {
  if (typeof record.data.arrayBuffer !== 'function')
    throw new Error(`${path}: blob bytes unavailable`);
  return new Uint8Array(await record.data.arrayBuffer());
}

function portableCharacter(character: Character) {
  return PortableCharacterSchema.parse({
    id: character.id,
    name: character.name,
    createdAt: character.createdAt,
    updatedAt: character.updatedAt,
    rigType: character.rigType,
    rig: character.rig,
    effectPrefs: character.effectPrefs,
  });
}

function portablePage(page: Page) {
  return {
    id: page.id,
    ...(page.characterId ? { characterId: page.characterId } : {}),
    backgroundId: page.backgroundId,
    text: page.text,
    ...(page.motionId ? { motionId: page.motionId } : {}),
    effectIds: page.effectIds,
    ...(page.narrationMime ? { narrationMime: page.narrationMime } : {}),
    advance: page.advance,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };
}

export async function exportBundle(selection: ExportSelection): Promise<Blob> {
  const characterIds = new Set(selection.characterIds ?? []);
  const bookIds = [...new Set(selection.bookIds ?? [])];
  const books = await Promise.all(
    bookIds.map(async (bookId) => {
      const book = await booksRepo.get(bookId);
      if (!book) throw new Error(`Book not found (${bookId})`);
      const pages = await pagesRepo.listByBook(book.id);
      pages.forEach((page) => {
        if (page.characterId) characterIds.add(page.characterId);
      });
      return { book, pages };
    }),
  );
  const characters = await Promise.all(
    [...characterIds].map(async (characterId) => {
      const character = await charactersRepo.get(characterId);
      if (!character) throw new Error(`Character not found (${characterId})`);
      const drawing = await drawingsRepo.get(character.drawingId);
      const texture = await blobsRepo.get(character.textureBlobId);
      const thumb = await blobsRepo.get(character.thumbBlobId);
      if (!drawing || !texture || !thumb)
        throw new Error(`Character ${characterId} has missing blobs`);
      return { character, drawing, texture, thumb };
    }),
  );
  const manifest = ExportManifestSchema.parse({
    formatVersion: 1,
    appVersion: pkg.version,
    exportedAt: Date.now(),
    characterIds: [...characterIds],
    bookIds,
  });
  const entries: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify(manifest)),
  };
  for (const { character, drawing, texture, thumb } of characters) {
    entries[`characters/${character.id}/character.json`] = strToU8(
      JSON.stringify(portableCharacter(character)),
    );
    entries[`characters/${character.id}/texture.png`] = await blobBytes(
      texture,
      `characters/${character.id}/texture.png`,
    );
    entries[`characters/${character.id}/thumb.png`] = await blobBytes(
      thumb,
      `characters/${character.id}/thumb.png`,
    );
    // Accessing the Drawing also verifies that the source row/blob remains valid.
    const image = await blobsRepo.get(drawing.imageBlobId);
    if (!image)
      throw new Error(
        `Character ${character.id} has missing drawing image blob`,
      );
    await blobBytes(image, `characters/${character.id}/drawing`);
  }
  for (const { book, pages } of books) {
    const portablePages = [];
    for (const page of pages) {
      portablePages.push(portablePage(page));
      if (page.narrationBlobId) {
        const audio = await blobsRepo.get(page.narrationBlobId);
        if (!audio)
          throw new Error(`Page ${page.id} has missing narration blob`);
        entries[`books/${book.id}/audio/${page.id}.bin`] = await blobBytes(
          audio,
          `books/${book.id}/audio/${page.id}.bin`,
        );
      }
    }
    const portableBook = PortableBookSchema.parse({
      id: book.id,
      title: book.title,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
      pages: portablePages,
    });
    entries[`books/${book.id}/book.json`] = strToU8(
      JSON.stringify(portableBook),
    );
  }
  const bytes = zipSync(entries);
  return new Blob([bytes], { type: 'application/zip' });
}

export function bundleFilename(date = new Date()): string {
  const iso = date.toISOString().slice(0, 10).replaceAll('-', '');
  return `inkstory-${iso}.inkstory`;
}

export function downloadBundle(blob: Blob, filename = bundleFilename()): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  queueMicrotask(() => URL.revokeObjectURL(url));
}
