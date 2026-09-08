import { beforeEach, describe, expect, it } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { db } from './db';
import { saveSampleRecords } from './seed';
function fixture() {
  const id = () => crypto.randomUUID();
  const now = Date.now();
  const blob = {
    id: id(),
    mime: 'image/png',
    data: new NodeBlob(['image'], { type: 'image/png' }) as unknown as Blob,
    size: 5,
    createdAt: now,
  };
  const drawing = {
    id: id(),
    createdAt: now,
    source: 'file' as const,
    imageBlobId: blob.id,
    width: 10,
    height: 10,
  };
  const character = {
    id: id(),
    name: 'sample',
    createdAt: now,
    updatedAt: now,
    rigType: 'cutout' as const,
    drawingId: drawing.id,
    textureBlobId: blob.id,
    thumbBlobId: blob.id,
    rig: null,
    effectPrefs: {},
  };
  const book = {
    id: id(),
    title: 'sample',
    createdAt: now,
    updatedAt: now,
    pageOrder: [] as string[],
  };
  return { drawing, character, blobs: [blob], book, pages: [] };
}
beforeEach(async () => {
  await db.delete();
  await db.open();
});
describe('atomic sample seeding', () => {
  it('seeds once and restores independent copies only when asked', async () => {
    await saveSampleRecords(fixture());
    await saveSampleRecords(fixture());
    expect(await db.characters.count()).toBe(1);
    await saveSampleRecords(fixture(), true);
    expect(await db.characters.count()).toBe(2);
    expect((await db.settings.get('samples.ids'))?.value).toHaveLength(4);
  });
  it('does not mark seeding complete or write partial records after invalid data', async () => {
    const data = fixture();
    data.book.title = 'x'.repeat(101);
    await expect(saveSampleRecords(data)).rejects.toThrow();
    expect(await db.characters.count()).toBe(0);
    expect(await db.settings.count()).toBe(0);
  });
});
