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
});
