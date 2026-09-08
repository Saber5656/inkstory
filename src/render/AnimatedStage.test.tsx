import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>['resolve'];
  let reject!: Deferred<T>['reject'];
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const state = vi.hoisted(() => {
  const initQueue: Array<Promise<void>> = [];
  const appInstances: MockApplication[] = [];
  const actorInstances: MockActor[] = [];
  const motionLoads = new Map<string, Promise<unknown>>();
  const textureLoads: Array<Promise<MockTexture>> = [];

  class MockTexture {
    static WHITE: MockTexture;
    width = 64;
    height = 64;
    destroyed = false;
    destroy = vi.fn(() => {
      this.destroyed = true;
    });
  }
  MockTexture.WHITE = new MockTexture();

  const point = () => ({
    x: 0,
    y: 0,
    set(x: number, y = x) {
      this.x = x;
      this.y = y;
    },
  });

  class MockContainer {
    children: MockContainer[] = [];
    destroyed = false;
    visible = true;
    position = point();
    scale = point();
    rotation = 0;
    alpha = 1;
    addChild(...children: MockContainer[]): MockContainer {
      this.children.push(...children);
      return children[0]!;
    }
    removeChildren(): MockContainer[] {
      const children = this.children;
      this.children = [];
      return children;
    }
    destroy(): void {
      if (this.destroyed) return;
      this.destroyed = true;
      this.children.forEach((child) => child.destroy());
    }
  }

  class MockSprite extends MockContainer {
    texture: MockTexture;
    anchor = point();
    width = 1;
    height = 1;
    constructor(texture: MockTexture) {
      super();
      this.texture = texture;
    }
  }

  class MockGraphics extends MockContainer {
    rect(): this {
      return this;
    }
    circle(): this {
      return this;
    }
    fill(): this {
      return this;
    }
  }

  class MockActor extends MockContainer {
    setEffects = vi.fn();
    setClip = vi.fn();
    setSpeed = vi.fn();
    setReducedMotion = vi.fn();
    play = vi.fn();
    pause = vi.fn();
    setMotionClip = vi.fn();
    fitToSize = vi.fn();
    setStagePosition = vi.fn();
    setTexture = vi.fn();
    constructor() {
      super();
      actorInstances.push(this);
    }
  }

  class MockApplication {
    stage = new MockContainer();
    renderer = { resize: vi.fn() };
    canvas = document.createElement('canvas');
    ticker = { add: vi.fn(), remove: vi.fn() };
    init = vi.fn(() => initQueue.shift() ?? Promise.resolve());
    destroy = vi.fn(() => {
      this.renderer = null as never;
      this.stage.destroy();
    });
    constructor() {
      appInstances.push(this);
    }
  }

  return {
    MockTexture,
    MockContainer,
    MockSprite,
    MockGraphics,
    MockActor,
    MockApplication,
    appInstances,
    actorInstances,
    initQueue,
    motionLoads,
    textureLoads,
  };
});

vi.mock('pixi.js/unsafe-eval', () => ({}));
vi.mock('pixi.js', () => ({
  Application: state.MockApplication,
  Assets: { load: vi.fn(() => Promise.resolve(new state.MockTexture())) },
  Container: state.MockContainer,
  Graphics: state.MockGraphics,
  Sprite: state.MockSprite,
  Texture: state.MockTexture,
}));
vi.mock('./CharacterActor', () => ({ CharacterActor: state.MockActor }));
vi.mock('./textureLoader', () => ({
  isInlineCharacterTexture: (url: string) => /^(blob:|data:)/.test(url),
  loadCharacterTexture: vi.fn(
    () =>
      state.textureLoads.shift() ?? Promise.resolve(new state.MockTexture()),
  ),
}));
vi.mock('../motion', async () => {
  const actual = await vi.importActual<typeof import('../motion')>('../motion');
  return {
    ...actual,
    loadMotionClip: vi.fn(
      (id: string) => state.motionLoads.get(id) ?? Promise.resolve({ id }),
    ),
  };
});

import { AnimatedStage } from './AnimatedStage';

const character = {
  textureUrl: 'blob:character',
  rig: null,
  rigType: 'cutout' as const,
};

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('AnimatedStage lifecycle', () => {
  beforeEach(() => {
    state.initQueue.length = 0;
    state.appInstances.length = 0;
    state.actorInstances.length = 0;
    state.motionLoads.clear();
    state.textureLoads.length = 0;
  });

  it('does not reinitialize Pixi when only aria-label changes', async () => {
    const init = deferred<void>();
    state.initQueue.push(init.promise);
    const view = render(
      <AnimatedStage
        character={character}
        motionId="idle"
        effectIds={[]}
        backgroundId="plain_cream"
        aria-label="first name"
      />,
    );
    await act(async () => {
      init.resolve();
      await flush();
    });
    view.rerender(
      <AnimatedStage
        character={character}
        motionId="idle"
        effectIds={[]}
        backgroundId="plain_cream"
        aria-label="renamed"
      />,
    );
    expect(state.appInstances).toHaveLength(1);
    expect(view.container.firstElementChild).toHaveAttribute(
      'aria-label',
      'renamed',
    );
    view.unmount();
  });

  it('applies only the newest asynchronous motion result', async () => {
    const init = deferred<void>();
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    state.initQueue.push(init.promise);
    state.motionLoads.set('first', first.promise);
    state.motionLoads.set('second', second.promise);
    const view = render(
      <AnimatedStage
        character={character}
        motionId="first"
        effectIds={[]}
        backgroundId="plain_cream"
      />,
    );
    await act(async () => {
      init.resolve();
      await flush();
    });
    view.rerender(
      <AnimatedStage
        character={character}
        motionId="second"
        effectIds={[]}
        backgroundId="plain_cream"
      />,
    );
    const actor = state.actorInstances[0]!;
    await act(async () => {
      second.resolve({ id: 'second' });
      await flush();
      first.resolve({ id: 'first' });
      await flush();
    });
    expect(actor.setMotionClip).toHaveBeenCalledTimes(1);
    expect(actor.setMotionClip).toHaveBeenCalledWith({ id: 'second' });
    view.unmount();
  });

  it('destroys a decoded inline texture that resolves after unmount', async () => {
    const init = deferred<void>();
    const textureLoad = deferred<InstanceType<typeof state.MockTexture>>();
    const texture = new state.MockTexture();
    state.initQueue.push(init.promise);
    state.textureLoads.push(textureLoad.promise);
    const view = render(
      <AnimatedStage
        character={character}
        motionId="idle"
        effectIds={[]}
        backgroundId="plain_cream"
      />,
    );
    await act(async () => {
      init.resolve();
      await flush();
    });
    view.unmount();
    await act(async () => {
      textureLoad.resolve(texture);
      await flush();
    });
    expect(texture.destroy).toHaveBeenCalledWith(true);
  });

  it('renders a fallback and removes it on unmount when init rejects', async () => {
    const init = deferred<void>();
    state.initQueue.push(init.promise);
    const view = render(
      <AnimatedStage
        character={character}
        motionId="idle"
        effectIds={[]}
        backgroundId="plain_cream"
        aria-label="読み込み失敗"
      />,
    );
    await act(async () => {
      init.reject(new Error('renderer unavailable'));
      await flush();
    });
    const fallback = view.container.querySelector('img');
    expect(fallback).toHaveClass('animated-stage-fallback');
    expect(fallback).toHaveAttribute('alt', '読み込み失敗');
    view.unmount();
    expect(document.body.querySelector('.animated-stage-fallback')).toBeNull();
  });
  it('destroys a renderer that finishes initializing after unmount', async () => {
    const init = deferred<void>();
    state.initQueue.push(init.promise);
    const view = render(
      <AnimatedStage
        character={character}
        motionId="idle"
        effectIds={[]}
        backgroundId="plain_cream"
      />,
    );
    const app = state.appInstances[0]!;
    app.renderer = undefined as never;
    view.unmount();
    expect(app.destroy).not.toHaveBeenCalled();
    app.renderer = { resize: vi.fn() };
    await act(async () => {
      init.resolve();
      await flush();
    });
    expect(app.destroy).toHaveBeenCalledTimes(1);
  });
});
