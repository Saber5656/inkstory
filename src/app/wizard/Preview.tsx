import { useMotionPreference } from '@/ui/motionPreference';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatedStage } from '@/render/AnimatedStage';
import { buildRig } from '@/rig/buildRig';
import type { JointMap } from '@/pose/mapping';
import type { prepareTexture } from './pipeline';
const effects: [] = [];
export function Preview({
  texture,
  joints,
  rigType,
}: {
  texture: Awaited<ReturnType<typeof prepareTexture>>;
  joints: JointMap;
  rigType: 'humanoid' | 'cutout';
}) {
  const reducedMotion = useMotionPreference();
  const { t } = useTranslation();
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const value = URL.createObjectURL(texture.blob);
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setUrl(value);
    });
    return () => {
      active = false;
      URL.revokeObjectURL(value);
    };
  }, [texture.blob]);
  const rig = useMemo(
    () =>
      rigType === 'humanoid'
        ? buildRig(
            texture.mask,
            texture.image.width,
            texture.image.height,
            joints,
          )
        : null,
    [texture, joints, rigType],
  );
  const actor = useMemo(
    () => ({ textureUrl: url ?? '', rig, rigType }),
    [url, rig, rigType],
  );
  return (
    <div className="stage-surface">
      <AnimatedStage
        reducedMotion={reducedMotion}
        character={actor}
        motionId="wave"
        effectIds={effects}
        backgroundId="meadow"
        aria-label={t('preview')}
      />
    </div>
  );
}
