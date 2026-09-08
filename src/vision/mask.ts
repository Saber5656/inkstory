export type BrushMode = 'add' | 'erase';

export interface BrushOptions { x: number; y: number; radius: number; mode?: BrushMode; }

export function applyBrush(mask: Uint8Array, width: number, height: number, options: BrushOptions): Uint8Array {
  const output = new Uint8Array(mask);
  const radius = Math.max(0, options.radius);
  const minX = Math.max(0, Math.floor(options.x - radius));
  const maxX = Math.min(width - 1, Math.ceil(options.x + radius));
  const minY = Math.max(0, Math.floor(options.y - radius));
  const maxY = Math.min(height - 1, Math.ceil(options.y + radius));
  const value = options.mode === 'erase' ? 0 : 255;
  const radiusSquared = radius * radius;
  for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
    if ((x - options.x) ** 2 + (y - options.y) ** 2 <= radiusSquared) output[y * width + x] = value;
  }
  return output;
}

export class MaskHistory {
  private readonly undoStack: Uint8Array[] = [];
  private readonly redoStack: Uint8Array[] = [];
  constructor(private readonly limit = 20) {}
  push(mask: Uint8Array): void { this.undoStack.push(new Uint8Array(mask)); if (this.undoStack.length > this.limit) this.undoStack.shift(); this.redoStack.length = 0; }
  undo(current: Uint8Array): Uint8Array { const previous = this.undoStack.pop(); if (!previous) return new Uint8Array(current); this.redoStack.push(new Uint8Array(current)); return previous; }
  redo(current: Uint8Array): Uint8Array { const next = this.redoStack.pop(); if (!next) return new Uint8Array(current); this.undoStack.push(new Uint8Array(current)); return next; }
  clear(): void { this.undoStack.length = 0; this.redoStack.length = 0; }
}
