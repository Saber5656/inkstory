/** Binary morphology helpers. Pixels are represented as 0 or 255. */
export function dilate(
  input: Uint8Array,
  width: number,
  height: number,
  iterations = 1,
): Uint8Array {
  return morph(input, width, height, iterations, true);
}

export function erode(
  input: Uint8Array,
  width: number,
  height: number,
  iterations = 1,
): Uint8Array {
  return morph(input, width, height, iterations, false);
}

export function close(
  input: Uint8Array,
  width: number,
  height: number,
  iterations = 1,
): Uint8Array {
  return erode(
    dilate(input, width, height, iterations),
    width,
    height,
    iterations,
  );
}

function morph(
  input: Uint8Array,
  width: number,
  height: number,
  iterations: number,
  max: boolean,
): Uint8Array {
  let current = new Uint8Array(input);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = new Uint8Array(current.length);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let value = max ? 0 : 255;
        for (let dy = -1; dy <= 1; dy += 1) {
          const yy = y + dy;
          if (yy < 0 || yy >= height) {
            if (!max) value = 0;
            continue;
          }
          for (let dx = -1; dx <= 1; dx += 1) {
            const xx = x + dx;
            if (xx < 0 || xx >= width) {
              if (!max) value = 0;
              continue;
            }
            const pixel = current[yy * width + xx] ?? 0;
            if (max ? pixel > value : pixel < value) value = pixel;
          }
        }
        next[y * width + x] = value;
      }
    }
    current = next;
  }
  return current;
}
