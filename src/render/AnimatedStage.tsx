import { useEffect, useRef } from 'react';
import { Application, Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { loadMotionClip } from '../motion';
import { CharacterActor, type CharacterActorOptions } from './CharacterActor';
import type { EffectId } from './effects';
import './AnimatedStage.css';

export type AnimatedStageProps = { character: CharacterActorOptions; motionId: string; effectIds: EffectId[]; backgroundId: string; playing?: boolean; speed?: number; className?: string; 'aria-label'?: string };
const BACKGROUNDS: Record<string, string> = { meadow: '/backgrounds/meadow.svg', forest: '/backgrounds/forest.svg', night: '/backgrounds/night.svg', ocean: '/backgrounds/ocean.svg', sky: '/backgrounds/sky.svg', space: '/backgrounds/space.svg', city: '/backgrounds/city.svg', rainbow: '/backgrounds/rainbow.svg' };
const PLAIN_COLORS: Record<string, string> = { plain_cream: '#fff7e6', plain_blue: '#e0f2fe', plain_pink: '#fce7f3', plain_lilac: '#ede9fe' };
const asset = (path: string): string => /^(blob:|data:|https?:\/\/)/.test(path) ? path : `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;

function drawBackground(container: Container, id: string, width: number, height: number): void {
  container.removeChildren().forEach((child) => child.destroy());
  container.addChild(new Graphics().rect(0, 0, width, height).fill(PLAIN_COLORS[id] ?? '#f7f1e3'));
  const image = BACKGROUNDS[id];
  if (image) void Assets.load<Texture>(asset(image)).then((texture) => { if (container.destroyed) return; const sprite = new Sprite(texture); sprite.width = width; sprite.height = height; container.addChild(sprite); }, () => undefined);
}

export function AnimatedStage({ character, motionId, effectIds, backgroundId, playing = true, speed = 1, className, 'aria-label': ariaLabel = 'Animated character stage' }: AnimatedStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const actorRef = useRef<CharacterActor | null>(null);
  const backdropRef = useRef<Container | null>(null);
  const initialBackgroundRef = useRef(backgroundId);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let disposed = false;
    let initialized = false;
    const app = new Application();
    const actor = new CharacterActor({ ...character });
    actorRef.current = actor;
    actor.fitToSize(Math.min(host.clientWidth || 320, host.clientHeight || 240) * 0.55);
    if (typeof Image !== 'undefined' && character.textureUrl) void Assets.load<Texture>(asset(character.textureUrl)).then((texture) => { if (!disposed) actor.setTexture(texture); }, () => undefined);
    void app.init({ resizeTo: host, antialias: true, background: '#f7f1e3' }).then(() => {
      if (disposed) { app.destroy(true); return; }
      initialized = true;
      const backdrop = new Container();
      backdropRef.current = backdrop;
      drawBackground(backdrop, initialBackgroundRef.current, host.clientWidth || 320, host.clientHeight || 240);
      app.stage.addChild(backdrop, actor);
      actor.setStagePosition((host.clientWidth || 320) / 2, (host.clientHeight || 320) * 0.58);
      actor.fitToSize(Math.min(host.clientWidth || 320, host.clientHeight || 240) * 0.55);
      app.ticker.add((ticker) => actor.tick(ticker.deltaMS));
    });
    return () => {
      disposed = true;
      actorRef.current = null;
      backdropRef.current = null;
      if (initialized) app.destroy(true);
    };
  }, [character]);

  useEffect(() => {
    const actor = actorRef.current;
    if (!actor) return undefined;
    actor.setEffects(effectIds);
    actor.setClip(motionId);
    actor.setSpeed(speed);
    if (playing) actor.play(); else actor.pause();
    if (typeof fetch === 'function') void loadMotionClip(motionId, fetch, import.meta.env.BASE_URL).then((clip) => actor.setMotionClip(clip), () => undefined);
    return undefined;
  }, [effectIds, motionId, playing, speed]);

  useEffect(() => {
    const backdrop = backdropRef.current;
    const host = hostRef.current;
    if (backdrop && host) drawBackground(backdrop, backgroundId, host.clientWidth || 320, host.clientHeight || 240);
  }, [backgroundId]);

  const classes = ['animated-stage', className].filter(Boolean).join(' ');
  return <div ref={hostRef} className={classes} aria-label={ariaLabel} role="img" />;
}
