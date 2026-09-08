import { useMotionPreference } from '@/ui/motionPreference';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Character } from '@/domain/types';
import { charactersRepo } from '@/storage/repos/characters';
import { useBlobUrl } from '@/ui/useBlobUrl';
import { AnimatedStage } from '@/render/AnimatedStage';
import { EFFECTS, type EffectId } from '@/render/effects';
import { backgrounds, motionCatalog } from '@/book/catalog';
export default function Stage() {
  const { id } = useParams();
  const reducedMotion = useMotionPreference();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<Character>();
  const [motion, setMotion] = useState('idle_breathe');
  const [background, setBackground] = useState('meadow');
  const [effects, setEffects] = useState<EffectId[]>([]);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [error, setError] = useState('');
  const surface = useRef<HTMLDivElement>(null);
  const renameQueue = useRef(Promise.resolve());
  const textureUrl = useBlobUrl(character?.textureBlobId);
  const locale = i18n.language === 'en' ? 'en' : 'ja';
  useEffect(() => {
    let active = true;
    if (id)
      void charactersRepo
        .get(id)
        .then((value) => {
          if (active) {
            setCharacter(value);
            setEffects((value?.effectPrefs.effectIds as EffectId[]) ?? []);
          }
        })
        .catch(() => setError(t('error')));
    return () => {
      active = false;
    };
  }, [id, t]);
  const actor = useMemo(
    () => ({
      textureUrl: textureUrl ?? '',
      rig: character?.rig ?? null,
      rigType: character?.rigType ?? ('cutout' as const),
    }),
    [textureUrl, character],
  );
  function rename(name: string) {
    if (!character) return;
    const value = { ...character, name, updatedAt: Date.now() };
    setCharacter(value);
    if (name.trim())
      renameQueue.current = renameQueue.current
        .catch(() => undefined)
        .then(async () => {
          await charactersRepo.put(value);
        })
        .catch(() => setError(t('error')));
  }
  return (
    <main>
      <div className="toolbar">
        <button onClick={() => navigate('/')}>{t('back')}</button>
        <button
          onClick={() => {
            void surface.current?.requestFullscreen?.().catch(console.warn);
          }}
        >
          {t('fullscreen')}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {character ? (
        <>
          <label className="title-field">
            {t('name')}
            <input
              value={character.name}
              maxLength={50}
              onChange={(e) => rename(e.target.value)}
            />
          </label>
          <div className="stage-layout">
            <div ref={surface} className="stage-surface">
              <AnimatedStage
                reducedMotion={reducedMotion}
                character={actor}
                motionId={motion}
                effectIds={effects}
                backgroundId={background}
                playing={playing}
                speed={speed}
                aria-label={character.name}
              />
            </div>
            <aside className="controls">
              {character.rigType === 'humanoid' && (
                <>
                  <h2>{t('motion')}</h2>
                  <div className="pick-grid">
                    {motionCatalog.map((clip) => (
                      <button
                        key={clip.id}
                        aria-pressed={motion === clip.id}
                        onClick={() => setMotion(clip.id)}
                      >
                        {clip.name[locale]}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <label>
                {t('background')}
                <select
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                >
                  {backgrounds.map((value) => (
                    <option key={value} value={value}>
                      {t(`background_${value}`)}
                    </option>
                  ))}
                </select>
              </label>
              <h2>{t('effects')}</h2>
              <div className="pick-grid">
                {EFFECTS.filter((effect) =>
                  effect.allowedRigTypes.includes(character.rigType),
                ).map((effect) => (
                  <button
                    key={effect.id}
                    aria-pressed={effects.includes(effect.id)}
                    disabled={
                      !effects.includes(effect.id) && effects.length >= 3
                    }
                    onClick={() =>
                      setEffects((current) =>
                        current.includes(effect.id)
                          ? current.filter((id) => id !== effect.id)
                          : [...current, effect.id],
                      )
                    }
                  >
                    {effect.name[locale]}
                  </button>
                ))}
              </div>
              <label>
                {t('speed')}
                <input
                  type="range"
                  min=".5"
                  max="2"
                  step=".1"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                />
              </label>
              <button onClick={() => setPlaying((value) => !value)}>
                {t(playing ? 'pause' : 'resume')}
              </button>
            </aside>
          </div>
        </>
      ) : (
        <p role="status">{t('loading')}</p>
      )}
    </main>
  );
}
