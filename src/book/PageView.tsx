import { useMotionPreference } from '@/ui/motionPreference';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Character, Page } from '@/domain/types';
import { useBlobUrl } from '@/ui/useBlobUrl';
import { AnimatedStage } from '@/render/AnimatedStage';
import type { EffectId } from '@/render/effects';
export function PageView({
  page,
  character,
  mode,
  playing = true,
}: {
  page: Page;
  character?: Character;
  mode: 'preview' | 'play';
  playing?: boolean;
}) {
  const reducedMotion = useMotionPreference();
  const { t } = useTranslation();
  const textureUrl = useBlobUrl(character?.textureBlobId);
  const actor = useMemo(
    () => ({
      textureUrl: textureUrl ?? '',
      rig: character?.rig ?? null,
      rigType: character?.rigType ?? ('cutout' as const),
    }),
    [textureUrl, character?.rig, character?.rigType],
  );
  const effects = useMemo(() => page.effectIds as EffectId[], [page.effectIds]);
  return (
    <div className={`page-view ${mode}`}>
      <div className="stage-surface">
        <AnimatedStage
          reducedMotion={reducedMotion}
          character={actor}
          motionId={page.motionId ?? 'idle_breathe'}
          effectIds={effects}
          backgroundId={page.backgroundId}
          playing={playing}
          aria-label={character?.name ?? t('noCharacter')}
        />
      </div>
      {page.text && (
        <div
          className={`story-panel ${page.text.length > 200 ? 'long' : page.text.length > 80 ? 'medium' : ''}`}
        >
          {page.text}
        </div>
      )}
    </div>
  );
}
