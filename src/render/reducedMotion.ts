const QUERY = '(prefers-reduced-motion: reduce)';

type MediaQuerySource = Pick<
  MediaQueryList,
  'matches' | 'addEventListener' | 'removeEventListener'
>;

function mediaQuery(): MediaQuerySource | undefined {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return undefined;
  return window.matchMedia(QUERY);
}

export function getSystemReducedMotion(): boolean {
  return mediaQuery()?.matches ?? false;
}

export function resolveReducedMotion(
  override: boolean | undefined,
  system: boolean,
): boolean {
  return override ?? system;
}

export function capMotionSpeed(speed: number, reduced: boolean): number {
  return reduced ? Math.min(1, speed) : speed;
}

export function subscribeReducedMotion(
  onChange: (reduced: boolean) => void,
): () => void {
  const query = mediaQuery();
  if (!query) {
    onChange(false);
    return () => undefined;
  }
  const listener = (event: MediaQueryListEvent): void =>
    onChange(event.matches);
  onChange(query.matches);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
