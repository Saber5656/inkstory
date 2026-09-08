import { PageThumbnail } from './PageThumbnail';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Character, Page } from '@/domain/types';
import { charactersRepo } from '@/storage/repos/characters';
import { pagesRepo } from '@/storage/repos/pages';
import { suggestMotions } from '@/domain/suggestMotions';
import { useBookStore } from './bookStore';
import { PageView } from './PageView';
import { backgrounds, motionCatalog } from './catalog';
import { EFFECTS, type EffectId } from '@/render/effects';
import { Narration } from '@/audio/Narration';
import { Dialog } from '@/ui/Dialog';
export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const store = useBookStore();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [error, setError] = useState('');
  const [mutating, setMutating] = useState(false);
  const [deleting, setDeleting] = useState<string>();
  const [dragged, setDragged] = useState<string>();
  const explicitMotions = useRef(new Set<string>());
  const locale = i18n.language === 'en' ? 'en' : 'ja';
  const page = store.pages.find((page) => page.id === store.selectedId);
  const character = characters.find(
    (character) => character.id === page?.characterId,
  );
  const suggestions = suggestMotions(page?.text ?? '', locale, motionCatalog);
  useEffect(() => {
    if (id)
      void useBookStore
        .getState()
        .load(id)
        .then(() => {
          explicitMotions.current = new Set(
            useBookStore
              .getState()
              .pages.filter((page) => !!page.motionId)
              .map((page) => page.id),
          );
        })
        .catch(() => setError(t('error')));
    void charactersRepo
      .listByRecency()
      .then(setCharacters)
      .catch(() => setError(t('error')));
    const flush = () => {
      void useBookStore.getState().flush().catch(console.warn);
    };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    const hidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', hidden);
      flush();
    };
  }, [id, t]);
  function change(patch: Partial<Page>) {
    if (!page) return;
    store.updatePage({ ...page, ...patch, updatedAt: Date.now() });
  }
  async function leave(path: string) {
    try {
      await store.flush();
      navigate(path);
    } catch {
      setError(t('error'));
    }
  }
  async function move(pageId: string, direction: number) {
    const ids = store.pages.map((page) => page.id);
    const index = ids.indexOf(pageId);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    ids.splice(index, 1);
    ids.splice(target, 0, pageId);
    await store.reorder(ids);
  }
  async function updateNarration(input?: { blob: Blob; mime: string }) {
    if (!page) return;
    const pageId = page.id;
    await useBookStore.getState().flush();
    const saved = await pagesRepo.replaceNarration(pageId, input);
    const current = useBookStore
      .getState()
      .pages.find((row) => row.id === pageId);
    if (!current) return;
    const updated = { ...current, updatedAt: Date.now() };
    delete updated.narrationBlobId;
    delete updated.narrationMime;
    if (saved.narrationBlobId) updated.narrationBlobId = saved.narrationBlobId;
    if (saved.narrationMime) updated.narrationMime = saved.narrationMime;
    useBookStore.getState().updatePage(updated);
    await useBookStore.getState().flush();
  }
  const saveNarration = (blob: Blob, mime: string) =>
    updateNarration({ blob, mime });
  const deleteNarration = () => updateNarration();
  return (
    <main>
      <div className="toolbar">
        <button
          onClick={() => {
            void leave('/');
          }}
        >
          {t('back')}
        </button>
        <span role="status" className="status">
          {t(
            store.status === 'saved'
              ? 'saved'
              : store.status === 'saving'
                ? 'saving'
                : 'error',
          )}
        </span>
        <button
          className="primary"
          disabled={mutating || !store.pages.length}
          onClick={() => {
            void leave(`/books/${id ?? ''}/play`);
          }}
        >
          {t('play')}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {store.book && (
        <label>
          {t('bookTitle')}
          <input
            maxLength={100}
            value={store.book.title}
            onChange={(e) => store.rename(e.target.value)}
          />
        </label>
      )}
      <div className="editor-layout">
        <aside className="page-rail" aria-label={t('books')}>
          {store.pages.map((item, index) => (
            <div
              key={item.id}
              className={`page-item ${item.id === page?.id ? 'active' : ''}`}
              draggable
              onDragStart={() => setDragged(item.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragged) {
                  const ids = store.pages
                    .map((page) => page.id)
                    .filter((id) => id !== dragged);
                  ids.splice(index, 0, dragged);
                  void store.reorder(ids).catch(() => setError(t('error')));
                  setDragged(undefined);
                }
              }}
            >
              <button
                aria-current={item.id === page?.id ? 'page' : undefined}
                onClick={() => store.select(item.id)}
              >
                <PageThumbnail page={item} characters={characters} />
                {t('page', { number: index + 1 })}
              </button>
              <div className="actions">
                <button
                  disabled={index === 0}
                  aria-label={t('moveUp')}
                  onClick={() => {
                    void move(item.id, -1).catch(() => setError(t('error')));
                  }}
                >
                  ↑
                </button>
                <button
                  disabled={index === store.pages.length - 1}
                  aria-label={t('moveDown')}
                  onClick={() => {
                    void move(item.id, 1).catch(() => setError(t('error')));
                  }}
                >
                  ↓
                </button>
                <button
                  aria-label={t('delete')}
                  onClick={() => setDeleting(item.id)}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          <button
            disabled={mutating}
            onClick={() => {
              setMutating(true);
              void store
                .addPage()
                .catch(() => setError(t('error')))
                .finally(() => setMutating(false));
            }}
          >
            {t('addPage')}
          </button>
        </aside>
        {page ? (
          <>
            <PageView page={page} character={character} mode="preview" />
            <fieldset className="composer" disabled={mutating}>
              <label>
                {t('characters')}
                <select
                  value={page.characterId ?? ''}
                  onChange={(e) =>
                    change({
                      characterId: e.target.value || undefined,
                      motionId: page.motionId ?? suggestions[0],
                    })
                  }
                >
                  <option value="">{t('noCharacter')}</option>
                  {characters.map((character) => (
                    <option value={character.id} key={character.id}>
                      {character.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('background')}
                <select
                  value={page.backgroundId}
                  onChange={(e) => change({ backgroundId: e.target.value })}
                >
                  {backgrounds.map((background) => (
                    <option key={background} value={background}>
                      {t(`background_${background}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('pageText')}
                <textarea
                  maxLength={500}
                  value={page.text}
                  placeholder={t('textHint')}
                  onChange={(e) =>
                    change({
                      text: e.target.value,
                      ...(!explicitMotions.current.has(page.id)
                        ? {
                            motionId: suggestMotions(
                              e.target.value,
                              locale,
                              motionCatalog,
                            )[0],
                          }
                        : {}),
                    })
                  }
                />
                <span className="small">{page.text.length} / 500</span>
              </label>
              {character?.rigType === 'humanoid' && (
                <>
                  <h2>{t('suggestions')}</h2>
                  <div className="suggestions">
                    {suggestions.map((id) => (
                      <button
                        key={id}
                        onClick={() => {
                          explicitMotions.current.add(page.id);
                          change({ motionId: id });
                        }}
                      >
                        {motionCatalog.find((clip) => clip.id === id)?.name[
                          locale
                        ] ?? id}
                      </button>
                    ))}
                  </div>
                  <label>
                    {t('motion')}
                    <select
                      value={page.motionId ?? 'idle_breathe'}
                      onChange={(e) => {
                        explicitMotions.current.add(page.id);
                        change({ motionId: e.target.value });
                      }}
                    >
                      {motionCatalog.map((clip) => (
                        <option key={clip.id} value={clip.id}>
                          {clip.name[locale]}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <h2>{t('effects')}</h2>
              <div className="pick-grid">
                {EFFECTS.filter((effect) =>
                  effect.allowedRigTypes.includes(
                    character?.rigType ?? 'cutout',
                  ),
                ).map((effect) => (
                  <button
                    key={effect.id}
                    aria-pressed={page.effectIds.includes(effect.id)}
                    disabled={
                      !page.effectIds.includes(effect.id) &&
                      page.effectIds.length >= 3
                    }
                    onClick={() =>
                      change({
                        effectIds: page.effectIds.includes(effect.id)
                          ? page.effectIds.filter((id) => id !== effect.id)
                          : ([...page.effectIds, effect.id] as EffectId[]),
                      })
                    }
                  >
                    {effect.name[locale]}
                  </button>
                ))}
              </div>
              <h2>{t('record')}</h2>
              <Narration
                key={page.id}
                blobId={page.narrationBlobId}
                onSave={saveNarration}
                onDelete={deleteNarration}
              />
              <label>
                {t('advance')}
                <select
                  value={page.advance}
                  onChange={(e) =>
                    change({
                      advance: e.target.value === 'auto' ? 'auto' : 'tap',
                    })
                  }
                >
                  <option value="tap">{t('tap')}</option>
                  <option value="auto">{t('auto')}</option>
                </select>
              </label>
            </fieldset>
          </>
        ) : (
          <div className="empty">
            <h2>{t('noPages')}</h2>
          </div>
        )}
      </div>
      {deleting && (
        <Dialog
          title={t('confirmDelete', {
            name: t('page', {
              number: store.pages.findIndex((page) => page.id === deleting) + 1,
            }),
          })}
          onClose={() => setDeleting(undefined)}
          onConfirm={() => {
            void store
              .deletePage(deleting)
              .then(() => setDeleting(undefined))
              .catch(() => setError(t('error')));
          }}
          confirmLabel={t('delete')}
        />
      )}
    </main>
  );
}
