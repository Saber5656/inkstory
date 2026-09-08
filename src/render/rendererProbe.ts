export type RendererProbeTarget = {
  runners: {
    postrender: {
      add(listener: { postrender: () => void }): unknown;
      remove(listener: { postrender: () => void }): unknown;
    };
  };
};

type ProbeOptions = {
  durationMs?: number;
  now?: () => number;
  wait?: (durationMs: number) => Promise<void>;
};

const waitFor = (durationMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

export function createRendererFrameProbe(
  getRenderers: () => readonly RendererProbeTarget[],
  options: ProbeOptions = {},
): () => Promise<number> {
  const durationMs = options.durationMs ?? 5000;
  const now = options.now ?? (() => performance.now());
  const wait = options.wait ?? waitFor;
  return async () => {
    const renderers = getRenderers();
    const listeners = renderers.map(() => {
      let frames = 0;
      return {
        listener: {
          postrender: () => {
            frames += 1;
          },
        },
        get frames() {
          return frames;
        },
      };
    });
    const startedAt = now();
    renderers.forEach((renderer, index) =>
      renderer.runners.postrender.add(listeners[index]!.listener),
    );
    try {
      await wait(durationMs);
    } finally {
      renderers.forEach((renderer, index) =>
        renderer.runners.postrender.remove(listeners[index]!.listener),
      );
    }
    const elapsedMs = Math.max(1, now() - startedAt);
    const frames = listeners.length
      ? Math.min(...listeners.map((value) => value.frames))
      : 0;
    return (frames * 1000) / elapsedMs;
  };
}

const renderers = new Set<RendererProbeTarget>();

export function registerRendererForProbe(
  renderer: RendererProbeTarget,
): () => void {
  renderers.add(renderer);
  return () => renderers.delete(renderer);
}

export function installRendererFrameProbe(): void {
  if (typeof window === 'undefined' || import.meta.env.VITE_PERF_TEST !== '1')
    return;
  window.__inkstoryRendererFrameProbe ??= createRendererFrameProbe(() => [
    ...renderers,
  ]);
}

declare global {
  interface Window {
    __inkstoryRendererFrameProbe?: () => Promise<number>;
  }
}
