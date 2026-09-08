export function advanceDelay(
  mode: 'tap' | 'auto',
  hasNarration: boolean,
  ended: boolean,
): number | null {
  return mode === 'tap' ? null : !hasNarration ? 6000 : ended ? 1000 : null;
}
export function shouldExit(durationMs: number) {
  return durationMs >= 1000;
}
export function swipeDirection(deltaX: number, width: number): -1 | 0 | 1 {
  return Math.abs(deltaX) <= width * 0.25 ? 0 : deltaX < 0 ? 1 : -1;
}
