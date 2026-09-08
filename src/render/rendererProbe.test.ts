import { describe, expect, it } from 'vitest';
import { createRendererFrameProbe } from './rendererProbe';

describe('renderer performance probe', () => {
  it('counts postrender callbacks and removes its listeners', async () => {
    const listeners = new Set<{ postrender: () => void }>();
    const renderer = {
      runners: {
        postrender: {
          add: (listener: { postrender: () => void }) => {
            listeners.add(listener);
          },
          remove: (listener: { postrender: () => void }) => {
            listeners.delete(listener);
          },
        },
      },
    };
    let now = 0;
    const probe = createRendererFrameProbe(() => [renderer], {
      durationMs: 5000,
      now: () => now,
      wait: () => {
        for (let frame = 0; frame < 3; frame += 1)
          for (const listener of listeners) listener.postrender();
        now = 1000;
        return Promise.resolve();
      },
    });

    await expect(probe()).resolves.toBe(3);
    expect(listeners).toHaveLength(0);
  });
  it('reports the slowest active renderer instead of summing frame rates', async () => {
    const listeners = [
      new Set<{ postrender: () => void }>(),
      new Set<{ postrender: () => void }>(),
    ];
    const renderers = listeners.map((set) => ({
      runners: {
        postrender: {
          add: (listener: { postrender: () => void }) => set.add(listener),
          remove: (listener: { postrender: () => void }) =>
            set.delete(listener),
        },
      },
    }));
    let now = 0;
    const probe = createRendererFrameProbe(() => renderers, {
      now: () => now,
      wait: () => {
        listeners.forEach((set, index) => {
          for (let frame = 0; frame < (index === 0 ? 60 : 30); frame++)
            set.forEach((listener) => listener.postrender());
        });
        now = 1000;
        return Promise.resolve();
      },
    });
    await expect(probe()).resolves.toBe(30);
    listeners.forEach((set) => expect(set.size).toBe(0));
  });
  it('reports zero when there is no active renderer', async () => {
    const probe = createRendererFrameProbe(() => [], {
      wait: () => Promise.resolve(),
    });
    await expect(probe()).resolves.toBe(0);
  });
});
