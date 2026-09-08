import { useEffect, useRef, useState } from 'react';
import 'pixi.js/unsafe-eval';
import {
  Application,
  Assets,
  Container,
  Graphics,
  Sprite,
  Texture,
} from 'pixi.js';
import { loadMotionClip } from '../motion';
import { CharacterActor, type CharacterActorOptions } from './CharacterActor';
import {
  isInlineCharacterTexture,
  loadCharacterTexture,
} from './textureLoader';
import type { EffectId } from './effects';
import {
  getSystemReducedMotion,
  resolveReducedMotion,
  subscribeReducedMotion,
} from './reducedMotion';
import {
  installRendererFrameProbe,
  registerRendererForProbe,
} from './rendererProbe';
import './AnimatedStage.css';

export type AnimatedStageProps = {
  character: CharacterActorOptions;
  motionId: string;
  effectIds: EffectId[];
  backgroundId: string;
  playing?: boolean;
  speed?: number;
  reducedMotion?: boolean;
  className?: string;
  'aria-label'?: string;
};
const BACKGROUNDS: Record<string, string> = {
  meadow: '/backgrounds/meadow.svg',
  forest: '/backgrounds/forest.svg',
  night: '/backgrounds/night.svg',
  ocean: '/backgrounds/ocean.svg',
  sky: '/backgrounds/sky.svg',
  space: '/backgrounds/space.svg',
  city: '/backgrounds/city.svg',
  rainbow: '/backgrounds/rainbow.svg',
};
const PLAIN_COLORS: Record<string, string> = {
  plain_cream: '#fff7e6',
  plain_blue: '#e0f2fe',
  plain_pink: '#fce7f3',
  plain_lilac: '#ede9fe',
};
const asset = (path: string): string =>
  /^(blob:|data:|https?:\/\/)/.test(path)
    ? path
    : `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
const backgroundRequests = new WeakMap<Container, number>();

function drawBackground(
  container: Container,
  id: string,
  width: number,
  height: number,
): void {
  const request = (backgroundRequests.get(container) ?? 0) + 1;
  backgroundRequests.set(container, request);
  container.removeChildren().forEach((child) => child.destroy());
  container.addChild(
    new Graphics()
      .rect(0, 0, width, height)
      .fill(PLAIN_COLORS[id] ?? '#f7f1e3'),
  );
  const image = BACKGROUNDS[id];
  if (image)
    void Assets.load<Texture>(asset(image)).then(
      (texture) => {
        if (
          container.destroyed ||
          backgroundRequests.get(container) !== request
        )
          return;
        const sprite = new Sprite(texture);
        sprite.width = width;
        sprite.height = height;
        container.addChild(sprite);
      },
      () => undefined,
    );
}

export function AnimatedStage({
  character,
  motionId,
  effectIds,
  backgroundId,
  playing = true,
  speed = 1,
  reducedMotion,
  className,
  'aria-label': ariaLabel = 'Animated character stage',
}: AnimatedStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<CharacterActor | null>(null);
  const backdropRef = useRef<Container | null>(null);
  const motionRequestRef = useRef(0);
  const ariaLabelRef = useRef(ariaLabel);
  const initialBackgroundRef = useRef(backgroundId);
  const backgroundIdRef = useRef(backgroundId);
  const [systemReducedMotion, setSystemReducedMotion] = useState(
    getSystemReducedMotion,
  );
  const effectiveReducedMotion = resolveReducedMotion(
    reducedMotion,
    systemReducedMotion,
  );
  const initialActorStateRef = useRef({
    motionId,
    effectIds,
    speed,
    playing,
    reducedMotion: effectiveReducedMotion,
  });

  useEffect(() => subscribeReducedMotion(setSystemReducedMotion), []);
  useEffect(() => {
    ariaLabelRef.current = ariaLabel;
    const fallback = hostRef.current?.querySelector('.animated-stage-fallback');
    fallback?.setAttribute('alt', ariaLabel);
  }, [ariaLabel]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let disposed = false;
    let appDestroyed = false;
    let actorDestroyed = false;
    let fallbackImage: HTMLImageElement | undefined;
    let unregisterRenderer: (() => void) | undefined;
    let observer: ResizeObserver | undefined;
    const app = new Application();
    const actor = new CharacterActor({
      ...character,
      ...initialActorStateRef.current,
    });
    actorRef.current = actor;
    if (import.meta.env.DEV) Object.assign(window, { __inkstoryActor: actor });
    actor.fitToSize(
      Math.min(host.clientWidth || 320, host.clientHeight || 240) * 0.55,
    );
    if (typeof Image !== 'undefined' && character.textureUrl)
      void loadCharacterTexture(asset(character.textureUrl)).then(
        (texture) => {
          const ownsTexture = isInlineCharacterTexture(
            asset(character.textureUrl),
          );
          if (!disposed && actorRef.current === actor && !actor.destroyed)
            actor.setTexture(texture, ownsTexture);
          else if (ownsTexture && !texture.destroyed) texture.destroy(true);
        },
        () => undefined,
      );
    const tick = (ticker: { deltaMS: number }): void => {
      if (!disposed) actor.tick(ticker.deltaMS);
    };
    const destroyApp = (): void => {
      if (!appDestroyed && app.renderer) {
        appDestroyed = true;
        unregisterRenderer?.();
        unregisterRenderer = undefined;
        observer?.disconnect();
        try {
          app.ticker?.remove(tick);
        } catch {
          // Ticker can be unavailable when Application.init rejects midway.
        }
        try {
          if (app.renderer)
            app.destroy(
              { removeView: true },
              { children: true, texture: false, textureSource: false },
            );
        } catch {
          // Keep actor cleanup best effort for partial renderer initialization.
        }
      }
      if (!actorDestroyed && !actor.destroyed) {
        actorDestroyed = true;
        actor.destroy({ children: true });
      }
    };
    const showFallback = (): void => {
      if (disposed || !character.textureUrl) return;
      const image = document.createElement('img');
      image.className = 'animated-stage-fallback';
      image.alt = ariaLabelRef.current;
      image.decoding = 'async';
      image.src = asset(character.textureUrl);
      host.appendChild(image);
      fallbackImage = image;
    };
    void app
      .init({ resizeTo: host, antialias: true, background: '#f7f1e3' })
      .then(() => {
        if (disposed) {
          destroyApp();
          return;
        }
        host.querySelector('.animated-stage-fallback')?.remove();
        installRendererFrameProbe();
        unregisterRenderer =
          import.meta.env.VITE_PERF_TEST === '1'
            ? registerRendererForProbe(app.renderer)
            : undefined;
        const backdrop = new Container();
        backdropRef.current = backdrop;
        host.appendChild(app.canvas);
        drawBackground(
          backdrop,
          initialBackgroundRef.current,
          host.clientWidth || 320,
          host.clientHeight || 240,
        );
        app.stage.addChild(backdrop, actor);
        const resize = (): void => {
          const width = host.clientWidth || 320;
          const height = host.clientHeight || 240;
          app.renderer.resize(width, height);
          actor.setStagePosition(width / 2, height * 0.58);
          actor.fitToSize(Math.min(width, height) * 0.55);
          drawBackground(backdrop, backgroundIdRef.current, width, height);
        };
        actor.setStagePosition(
          (host.clientWidth || 320) / 2,
          (host.clientHeight || 320) * 0.58,
        );
        actor.fitToSize(
          Math.min(host.clientWidth || 320, host.clientHeight || 240) * 0.55,
        );
        observer =
          typeof ResizeObserver === 'function'
            ? new ResizeObserver(resize)
            : undefined;
        observer?.observe(host);
        resize();
        app.ticker.add(tick);
      })
      .catch(() => {
        if (!disposed) showFallback();
        if (actorRef.current === actor) actorRef.current = null;
        destroyApp();
      });
    return () => {
      disposed = true;
      actorRef.current = null;
      motionRequestRef.current += 1;
      fallbackImage?.remove();
      fallbackImage = undefined;
      if (import.meta.env.DEV)
        delete (window as Window & { __inkstoryActor?: CharacterActor })
          .__inkstoryActor;
      backdropRef.current = null;
      destroyApp();
    };
  }, [character]);

  useEffect(() => {
    const actor = actorRef.current;
    if (!actor) return undefined;
    actor.setEffects(effectIds);
    actor.setClip(motionId);
    actor.setSpeed(speed);
    actor.setReducedMotion(effectiveReducedMotion);
    if (playing) actor.play();
    else actor.pause();
    const request = ++motionRequestRef.current;
    if (typeof fetch === 'function') {
      void loadMotionClip(motionId, fetch, import.meta.env.BASE_URL).then(
        (clip) => {
          if (
            request === motionRequestRef.current &&
            actorRef.current === actor &&
            !actor.destroyed
          )
            actor.setMotionClip(clip);
        },
        () => undefined,
      );
    }
    return () => {
      if (motionRequestRef.current === request) motionRequestRef.current += 1;
    };
  }, [character, effectIds, motionId, playing, speed, effectiveReducedMotion]);

  useEffect(() => {
    backgroundIdRef.current = backgroundId;
  }, [backgroundId]);

  useEffect(() => {
    const backdrop = backdropRef.current;
    const host = hostRef.current;
    if (backdrop && host)
      drawBackground(
        backdrop,
        backgroundId,
        host.clientWidth || 320,
        host.clientHeight || 240,
      );
  }, [backgroundId]);

  const classes = ['animated-stage', className].filter(Boolean).join(' ');
  return (
    <div ref={hostRef} className={classes} aria-label={ariaLabel} role="img" />
  );
}
