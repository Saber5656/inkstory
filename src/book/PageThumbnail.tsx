import type { Character, Page } from '@/domain/types';
import { useBlobUrl } from '@/ui/useBlobUrl';
export function PageThumbnail({
  page,
  characters,
}: {
  page?: Page;
  characters: Character[];
}) {
  const character = characters.find((c) => c.id === page?.characterId);
  const url = useBlobUrl(character?.thumbBlobId);
  const scene =
    page?.backgroundId && !page.backgroundId.startsWith('plain_')
      ? `${import.meta.env.BASE_URL}backgrounds/${page.backgroundId}.svg`
      : undefined;
  return (
    <div
      className={`page-thumbnail ${page?.backgroundId ?? 'plain_cream'}`}
      aria-hidden="true"
    >
      {scene && <img className="thumbnail-scene" src={scene} alt="" />}
      {url && <img className="thumbnail-character" src={url} alt="" />}
      {page?.text && <span>{page.text}</span>}
    </div>
  );
}
