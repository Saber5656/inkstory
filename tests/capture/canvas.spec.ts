/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { test, expect } from '@playwright/test';

// Start `pnpm dev --host 127.0.0.1` before this browser-only validation.
test('cropRotate exchanges dimensions and toTexture preserves large bbox pixels', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/');
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite resolves this browser module URL at runtime.
    const crop = await import('/src/capture/cropRotate.ts');
    // @ts-expect-error Vite resolves this browser module URL at runtime.
    const texture = await import('/src/vision/texture.ts');
    const source = document.createElement('canvas'); source.width = 4; source.height = 2;
    const sourceContext = source.getContext('2d');
    if (!sourceContext) throw new Error('2D canvas unavailable');
    sourceContext.fillStyle = '#e11'; sourceContext.fillRect(0, 0, 2, 2);
    sourceContext.fillStyle = '#14c'; sourceContext.fillRect(2, 0, 2, 2);
    const blob = await new Promise<Blob>((resolve, reject) => source.toBlob((value) => value ? resolve(value) : reject(new Error('encode failed')), 'image/png'));
    const rotated = await crop.cropRotate(blob, { rect: { x: 0, y: 0, width: 4, height: 2 }, rotationDeg: 90 });
    const drawingData = new Uint8ClampedArray(1100 * 1100 * 4); drawingData.fill(255);
    const mask = new Uint8Array(1100 * 1100);
    for (let y = 100; y < 1000; y += 1) for (let x = 100; x < 1000; x += 1) mask[y * 1100 + x] = 255;
    const output = await texture.toTexture(new ImageData(drawingData, 1100, 1100), mask);
    const decoded = await createImageBitmap(output.texturePng);
    return { rotated: [rotated.width, rotated.height], output: [decoded.width, decoded.height], bbox: output.bbox };
  });
  expect(result.rotated).toEqual([2, 4]);
  expect(result.output[0]).toBeLessThanOrEqual(1024);
  expect(result.output[1]).toBeLessThanOrEqual(1024);
  expect(result.bbox.width).toBe(916);
});

test('reencode applies EXIF orientation, strips APP1 metadata, and rejects bad input', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/');
  const result = await page.evaluate(async () => {
    // @ts-expect-error Vite resolves this browser module URL at runtime.
    const { reencode, ImageInputError } = await import('/src/capture/reencode.ts');
    const source = document.createElement('canvas'); source.width = 2; source.height = 4;
    const context = source.getContext('2d'); if (!context) throw new Error('2D canvas unavailable');
    context.fillStyle = '#e11'; context.fillRect(0, 0, 2, 2); context.fillStyle = '#14c'; context.fillRect(0, 2, 2, 2);
    const jpeg = await new Promise<Blob>((resolve, reject) => source.toBlob((value) => value ? resolve(value) : reject(new Error('encode failed')), 'image/jpeg'));
    const bytes = new Uint8Array(await jpeg.arrayBuffer());
    const exif = new Uint8Array(54); exif.set([0x45, 0x78, 0x69, 0x66, 0, 0, 0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 2]);
    exif.set([1, 0x12, 0, 3, 0, 0, 0, 1, 0, 6, 0, 0], 16);
    exif.set([0x88, 0x25, 0, 4, 0, 0, 0, 1, 0, 0, 0, 46], 28);
    const segment = new Uint8Array(4 + exif.length); segment.set([0xff, 0xe1, 0, exif.length + 2], 0); segment.set(exif, 4);
    const tagged = new Blob([bytes.slice(0, 2), segment, bytes.slice(2)], { type: 'image/jpeg' });
    const output = await reencode(tagged);
    const png = new Uint8Array(await output.png.arrayBuffer());
    let hasExif = false; for (let i = 0; i + 3 < png.length; i += 1) if (png[i] === 0x65 && png[i + 1] === 0x58 && png[i + 2] === 0x49 && png[i + 3] === 0x66) hasExif = true;
    let tooLarge = false; try { await reencode(new Blob([new Uint8Array(40 * 1024 * 1024 + 1)], { type: 'image/png' })); } catch (error) { const candidate = error as { messageKey?: string }; tooLarge = error instanceof ImageInputError && candidate.messageKey === 'capture.errors.tooLarge'; }
    let corrupt = false; try { await reencode(new Blob(['not an image'], { type: 'image/png' })); } catch (error) { const candidate = error as { messageKey?: string }; corrupt = error instanceof ImageInputError && candidate.messageKey === 'capture.errors.decodeFailed'; }
    return { output: [output.width, output.height], hasExif, tooLarge, corrupt };
  });
  expect(result.output).toEqual([4, 2]);
  expect(result.hasExif).toBe(false);
  expect(result.tooLarge).toBe(true);
  expect(result.corrupt).toBe(true);
});

test('vision worker returns a transferable segmentation result', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/');
  const result = await page.evaluate(async () => {
    const worker = new Worker('/src/vision/vision.worker.ts', { type: 'module' });
    const data = new Uint8ClampedArray(64 * 64 * 4); data.fill(255);
    for (let y = 16; y < 48; y += 1) for (let x = 16; x < 48; x += 1) { const i = (y * 64 + x) * 4; data[i] = 20; data[i + 1] = 20; data[i + 2] = 20; data[i + 3] = 255; }
    const response = await new Promise<{ result?: { mask: Uint8Array; coverage: number; ok: boolean }; error?: string }>((resolve) => {
      worker.onmessage = (event) => resolve(event.data); worker.postMessage({ id: 'worker-test', imageData: new ImageData(data, 64, 64) });
    });
    worker.terminate();
    return response.error ? { error: response.error } : { length: response.result?.mask.length, coverage: response.result?.coverage, ok: response.result?.ok };
  });
  expect(result.error).toBeUndefined();
  expect(result.length).toBe(64 * 64);
  expect(result.ok).toBe(true);
  expect(result.coverage).toBeGreaterThan(0.1);
});
