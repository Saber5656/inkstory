/**
 * Generate deterministic, project-created, photo-like vision fixtures.
 * No external image package is needed: PNGs are RGBA, filter 0, non-interlaced.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const width = 160;
const height = 192;
const fixtures = [
  { id: 'humanoid-pencil-faint', kind: 'humanoid', style: 'faint', seed: 11 },
  { id: 'humanoid-colored', kind: 'humanoid', style: 'colored', seed: 23 },
  { id: 'humanoid-shadow', kind: 'humanoid', style: 'shadow', seed: 37 },
  { id: 'humanoid-nonideal', kind: 'humanoid', style: 'nonideal', seed: 47 },
  { id: 'nonhumanoid-cat', kind: 'cat', style: 'colored', seed: 59 },
  { id: 'nonhumanoid-rocket', kind: 'rocket', style: 'colored', seed: 71 },
];

function chunk(type, data) {
  const bytes = new Uint8Array(8 + data.length + 4);
  writeU32(bytes, data.length, 0);
  bytes.set(type, 4);
  bytes.set(data, 8);
  writeU32(bytes, crc32(data, type), 8 + data.length);
  return bytes;
}
function writeU32(target, value, offset) {
  target[offset] = (value >>> 24) & 255;
  target[offset + 1] = (value >>> 16) & 255;
  target[offset + 2] = (value >>> 8) & 255;
  target[offset + 3] = value & 255;
}
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(data, prefix = new Uint8Array()) {
  let c = 0xffffffff;
  for (const byte of prefix) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
  for (const byte of data) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function png(width, height, rgba) {
  const raw = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 4);
    raw[row] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), row + 1);
  }
  const signature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  writeU32(ihdr, width, 0);
  writeU32(ihdr, height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const typeIHDR = Uint8Array.from([73, 72, 68, 82]);
  const typeIDAT = Uint8Array.from([73, 68, 65, 84]);
  const typeIEND = Uint8Array.from([73, 69, 78, 68]);
  const idat = new Uint8Array(deflateSync(raw));
  const out = new Uint8Array(signature.length + 25 + 12 + idat.length + 12);
  let at = 0;
  out.set(signature, at);
  at += signature.length;
  const h = chunk(typeIHDR, ihdr);
  out.set(h, at);
  at += h.length;
  const d = chunk(typeIDAT, idat);
  out.set(d, at);
  at += d.length;
  out.set(chunk(typeIEND, new Uint8Array()), at);
  return out;
}
function noise(seed) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 0x100000000 - 0.5;
  };
}
function image() {
  return {
    pixels: new Uint8ClampedArray(width * height * 4),
    mask: new Uint8Array(width * height),
  };
}
function pixel(canvas, x, y, color, mark = true) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const i = (y * width + x) * 4;
  canvas.pixels[i] = color[0];
  canvas.pixels[i + 1] = color[1];
  canvas.pixels[i + 2] = color[2];
  canvas.pixels[i + 3] = 255;
  if (mark) canvas.mask[y * width + x] = 255;
}
function circle(canvas, cx, cy, radius, color) {
  const r = Math.ceil(radius);
  for (let y = cy - r; y <= cy + r; y += 1)
    for (let x = cx - r; x <= cx + r; x += 1)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2)
        pixel(canvas, x, y, color);
}
function line(canvas, ax, ay, bx, by, radius, color) {
  const minX = Math.floor(Math.min(ax, bx) - radius),
    maxX = Math.ceil(Math.max(ax, bx) + radius),
    minY = Math.floor(Math.min(ay, by) - radius),
    maxY = Math.ceil(Math.max(ay, by) + radius);
  const dx = bx - ax,
    dy = by - ay,
    len = dx * dx + dy * dy;
  for (let y = minY; y <= maxY; y += 1)
    for (let x = minX; x <= maxX; x += 1) {
      const t = len
        ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len))
        : 0;
      const px = ax + t * dx,
        py = ay + t * dy;
      if ((x - px) ** 2 + (y - py) ** 2 <= radius ** 2)
        pixel(canvas, x, y, color);
    }
}
function polygon(canvas, points, color) {
  const minX = Math.floor(Math.min(...points.map((p) => p[0]))),
    maxX = Math.ceil(Math.max(...points.map((p) => p[0]))),
    minY = Math.floor(Math.min(...points.map((p) => p[1]))),
    maxY = Math.ceil(Math.max(...points.map((p) => p[1])));
  for (let y = minY; y <= maxY; y += 1)
    for (let x = minX; x <= maxX; x += 1) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i],
          [xj, yj] = points[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
          inside = !inside;
      }
      if (inside) pixel(canvas, x, y, color);
    }
}
function fillPaper(canvas, seed) {
  const rnd = noise(seed);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const shade = Math.round(
        245 + 3 * Math.sin(x / 31) + 2 * Math.sin(y / 23) + rnd() * 2,
      );
      pixel(canvas, x, y, [shade, shade - 2, shade - 7], false);
    }
}
function humanoid(canvas, style) {
  const dark =
    style === 'faint'
      ? [145, 141, 132]
      : style === 'shadow'
        ? [70, 64, 58]
        : [45, 68, 100];
  const accent =
    style === 'colored'
      ? [205, 72, 55]
      : style === 'nonideal'
        ? [103, 55, 38]
        : dark;
  circle(canvas, 80, 35, style === 'nonideal' ? 17 : 16, dark);
  if (style === 'nonideal') {
    polygon(
      canvas,
      [
        [62, 55],
        [95, 53],
        [108, 112],
        [91, 119],
        [69, 106],
      ],
      accent,
    );
    line(canvas, 67, 65, 35, 92, 8, dark);
    line(canvas, 99, 65, 126, 78, 6, dark);
    line(canvas, 74, 111, 57, 163, 9, dark);
    line(canvas, 91, 112, 103, 170, 10, dark);
    circle(canvas, 33, 94, 8, dark);
    circle(canvas, 128, 79, 7, dark);
  } else {
    polygon(
      canvas,
      [
        [64, 53],
        [96, 53],
        [101, 111],
        [59, 111],
      ],
      accent,
    );
    line(canvas, 66, 63, 35, 94, 7, dark);
    line(canvas, 94, 63, 126, 91, 7, dark);
    line(canvas, 35, 94, 27, 125, 6, dark);
    line(canvas, 126, 91, 135, 119, 6, dark);
    line(canvas, 67, 108, 54, 164, 9, dark);
    line(canvas, 93, 108, 107, 164, 9, dark);
    line(canvas, 54, 164, 42, 166, 6, dark);
    line(canvas, 107, 164, 120, 166, 6, dark);
    circle(canvas, 27, 126, 7, dark);
    circle(canvas, 135, 120, 7, dark);
  }
  if (style === 'faint') {
    // a light pencil highlight remains inside the broad strokes
    line(canvas, 80, 57, 80, 101, 2, [193, 190, 180]);
  }
}
function cat(canvas) {
  const fur = [91, 120, 67];
  circle(canvas, 78, 88, 34, fur);
  polygon(
    canvas,
    [
      [49, 65],
      [54, 35],
      [72, 58],
      [101, 57],
      [121, 34],
      [123, 74],
    ],
    fur,
  );
  line(canvas, 52, 113, 37, 154, 9, fur);
  line(canvas, 102, 113, 116, 154, 9, fur);
  line(canvas, 62, 113, 58, 158, 8, fur);
  line(canvas, 91, 113, 95, 158, 8, fur);
  circle(canvas, 63, 80, 4, [35, 35, 30]);
  circle(canvas, 93, 80, 4, [35, 35, 30]);
  line(canvas, 76, 95, 85, 95, 3, [55, 40, 35]);
}
function rocket(canvas) {
  const body = [157, 74, 49];
  polygon(
    canvas,
    [
      [80, 22],
      [105, 55],
      [109, 127],
      [95, 158],
      [65, 158],
      [51, 127],
      [55, 55],
    ],
    body,
  );
  circle(canvas, 80, 76, 13, [80, 160, 189]);
  polygon(
    canvas,
    [
      [54, 112],
      [26, 139],
      [56, 137],
    ],
    [181, 51, 43],
  );
  polygon(
    canvas,
    [
      [106, 112],
      [134, 139],
      [104, 137],
    ],
    [181, 51, 43],
  );
  polygon(
    canvas,
    [
      [68, 157],
      [80, 182],
      [92, 157],
    ],
    [233, 168, 48],
  );
}
function goldenMask(mask) {
  const out = new Uint8Array(mask);
  for (let pass = 0; pass < 2; pass += 1) {
    const next = new Uint8Array(out);
    for (let y = 1; y < height - 1; y += 1)
      for (let x = 1; x < width - 1; x += 1) {
        const i = y * width + x;
        if (
          out[i] ||
          out[i - 1] ||
          out[i + 1] ||
          out[i - width] ||
          out[i + width]
        )
          next[i] = 255;
      }
    out.set(next);
  }
  return out;
}
function rgbaMask(mask) {
  const out = new Uint8ClampedArray(mask.length * 4);
  for (let i = 0; i < mask.length; i += 1) {
    out[i * 4] = mask[i];
    out[i * 4 + 1] = mask[i];
    out[i * 4 + 2] = mask[i];
    out[i * 4 + 3] = 255;
  }
  return out;
}
function fixture(spec) {
  const canvas = image();
  fillPaper(canvas, spec.seed);
  if (spec.kind === 'humanoid') humanoid(canvas, spec.style);
  else if (spec.kind === 'cat') cat(canvas);
  else rocket(canvas);
  return canvas;
}
await mkdir('tests/fixtures/vision', { recursive: true });
for (const spec of fixtures) {
  const canvas = fixture(spec);
  await writeFile(
    `tests/fixtures/vision/${spec.id}.png`,
    png(width, height, canvas.pixels),
  );
  await writeFile(
    `tests/fixtures/vision/${spec.id}.golden.png`,
    png(width, height, rgbaMask(goldenMask(canvas.mask))),
  );
}
await writeFile(
  'tests/fixtures/vision/manifest.json',
  JSON.stringify({ width, height, fixtures }, null, 2) + '\n',
);
console.log(`generated ${fixtures.length} fixtures at ${width}x${height}`);
