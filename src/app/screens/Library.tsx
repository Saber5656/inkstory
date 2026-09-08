import { PageThumbnail } from '@/book/PageThumbnail';
import { pagesRepo } from '@/storage/repos/pages';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Book, Character, Page } from '@/domain/types';
import { charactersRepo } from '@/storage/repos/characters';
import { booksRepo } from '@/storage/repos/books';
import { settingsRepo } from '@/storage/repos/settings';
import { useBlobUrl } from '@/ui/useBlobUrl';
import { Dialog } from '@/ui/Dialog';
import { ensureSamples } from '@/samples/seed';
import { Onboarding } from '../onboarding/Onboarding';
function CharacterCard({
  character,
  onDelete,
}: {
  character: Character;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const url = useBlobUrl(character.thumbBlobId);
  return (
    <article className="creation-card">
      <Link className="art" to={`/characters/${character.id}`}>
        <img src={url} alt={character.name} />
      </Link>
      <div className="card-body">
        <h3>{character.name}</h3>
        <div className="actions">
          <span className="small">{t(character.rigType)}</span>
          <button
            className="quiet"
            aria-label={t('confirmDelete', { name: character.name })}
            onClick={onDelete}
          >
            ×
          </button>
        </div>
      </div>
    </article>
  );
}
export default function Library() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'characters' | 'books'>('characters');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [welcome, setWelcome] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<Character | Book>();
  const [loading, setLoading] = useState(true);
  const heroUrl = useBlobUrl(characters[0]?.textureBlobId);
  async function refresh() {
    setCharacters(await charactersRepo.listByRecency());
    setBooks(await booksRepo.listByRecency());
    setPages(await pagesRepo.list());
  }
  useEffect(() => {
    let active = true;
    void ensureSamples(i18n.language === 'en' ? 'en' : 'ja')
      .then(async () => {
        if (!active) return;
        await refresh();
        const shown = await settingsRepo.get('onboarding.dismissed');
        if (active) setWelcome(!shown?.value);
      })
      .catch((error) => {
        console.warn(error);
        if (active) setError(t('error'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [i18n.language, t]);
  function dismiss() {
    setWelcome(false);
    void settingsRepo
      .set('onboarding.dismissed', true)
      .catch(() => setError(t('error')));
  }
  async function createBook() {
    const now = Date.now();
    const book: Book = {
      id: crypto.randomUUID(),
      title: `${t('bookDefault')} ${books.length + 1}`,
      pageOrder: [],
      createdAt: now,
      updatedAt: now,
    };
    await booksRepo.put(book);
    navigate(`/books/${book.id}/edit`);
  }
  async function remove() {
    if (!deleting) return;
    try {
      if ('rigType' in deleting)
        await charactersRepo.deleteCharacter(deleting.id);
      else await booksRepo.deleteBook(deleting.id);
      setDeleting(undefined);
      await refresh();
    } catch (error) {
      console.warn(error);
      setDeleting(undefined);
      setError(t('deleteBlocked'));
    }
  }
  return (
    <main>
      {welcome && (
        <Onboarding
          sampleBookId={books[0]?.id}
          onDismiss={dismiss}
          onWatchSample={() => {
            dismiss();
            if (books[0]) navigate(`/books/${books[0].id}/play`);
          }}
        />
      )}
      <section className="hero">
        <div>
          <p className="eyebrow">{t('library')}</p>
          <h1>{t('tagline')}</h1>
          <p>{t('emptyHint')}</p>
          <Link className="primary button-link" to="/characters/new">
            {t('newCharacter')} <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className="hero-art">
          <img
            src={heroUrl ?? `${import.meta.env.BASE_URL}samples/ink.png`}
            alt=""
          />
        </div>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label={t('library')}>
          {(['characters', 'books'] as const).map((value) => (
            <button
              role="tab"
              key={value}
              aria-selected={tab === value}
              onClick={() => setTab(value)}
            >
              {t(value)}{' '}
              <span className="count">
                {value === 'characters' ? characters.length : books.length}
              </span>
            </button>
          ))}
        </div>
        {tab === 'books' && (
          <button
            className="primary"
            onClick={() => {
              void createBook().catch(() => setError(t('error')));
            }}
          >
            {t('newBook')}
          </button>
        )}
      </div>
      {loading ? (
        <p role="status">{t('loading')}</p>
      ) : (
        <div className="grid">
          {tab === 'characters'
            ? characters.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  onDelete={() => setDeleting(character)}
                />
              ))
            : books.map((book) => (
                <article className="creation-card" key={book.id}>
                  <Link
                    className="art book-cover"
                    to={`/books/${book.id}/edit`}
                  >
                    <PageThumbnail
                      page={pages.find((page) => page.id === book.pageOrder[0])}
                      characters={characters}
                    />
                    <h3>{book.title}</h3>
                  </Link>
                  <div className="card-body">
                    <div className="actions">
                      <Link to={`/books/${book.id}/play`}>{t('play')}</Link>
                      <button
                        className="quiet"
                        onClick={() => setDeleting(book)}
                        aria-label={t('confirmDelete', { name: book.title })}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </article>
              ))}
        </div>
      )}
      {!loading &&
        (tab === 'characters'
          ? characters.length === 0
          : books.length === 0) && (
          <div className="empty">
            <h2>
              {t(tab === 'characters' ? 'emptyCharacters' : 'emptyBooks')}
            </h2>
          </div>
        )}
      <footer className="privacy-note">
        <span aria-hidden="true">⌂</span>
        {t('privacyShort')}
      </footer>
      {deleting && (
        <Dialog
          title={t('confirmDelete', {
            name: 'name' in deleting ? deleting.name : deleting.title,
          })}
          onClose={() => setDeleting(undefined)}
          onConfirm={() => {
            void remove();
          }}
          confirmLabel={t('delete')}
        >
          <p>
            {t('deleteBody', {
              count: 'pageOrder' in deleting ? deleting.pageOrder.length : 0,
            })}
          </p>
        </Dialog>
      )}
    </main>
  );
}
