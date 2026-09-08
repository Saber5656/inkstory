import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { resolve } from 'node:path';

export interface DecodedPng {
  width: number;
  height: number;
  data: Uint8Array;
}
function u32(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a),
    pb = Math.abs(p - b),
    pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
export function decodeRgbaPng(path: string): DecodedPng {
  const bytes = new Uint8Array(readFileSync(path));
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((v, i) => bytes[i] === v))
    throw new Error(`invalid PNG signature: ${path}`);
  let at = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Uint8Array[] = [];
  while (at + 12 <= bytes.length) {
    const length = u32(bytes, at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    const body = bytes.subarray(at + 8, at + 8 + length);
    at += length + 12;
    if (type === 'IHDR') {
      width = u32(body, 0);
      height = u32(body, 4);
      bitDepth = body[8] ?? 0;
      colorType = body[9] ?? 0;
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
  }
  if (!width || !height || bitDepth !== 8 || colorType !== 6)
    throw new Error(`unsupported PNG: ${path}`);
  const raw = inflateSync(Buffer.concat(idat.map((part) => Buffer.from(part))));
  const stride = width * 4;
  const output = new Uint8Array(width * height * 4);
  let rawAt = 0;
  let previous = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawAt++] ?? 0;
    const row = new Uint8Array(raw.subarray(rawAt, rawAt + stride));
    rawAt += stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= 4 ? row[x - 4]! : 0;
      const up = previous[x] ?? 0;
      const upperLeft = x >= 4 ? previous[x - 4]! : 0;
      if (filter === 1) row[x] = (row[x]! + left) & 255;
      else if (filter === 2) row[x] = (row[x]! + up) & 255;
      else if (filter === 3)
        row[x] = (row[x]! + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4)
        row[x] = (row[x]! + paeth(left, up, upperLeft)) & 255;
      else if (filter !== 0)
        throw new Error(`unsupported PNG filter ${filter}`);
    }
    output.set(row, y * stride);
    previous = row;
  }
  return { width, height, data: output };
}
export function fixturePath(id: string, golden = false): string {
  return resolve(
    process.cwd(),
    'tests/fixtures/vision',
    `${id}${golden ? '.golden' : ''}.png`,
  );
}
