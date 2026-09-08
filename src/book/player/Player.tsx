import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Character, Page } from '@/domain/types';
import { booksRepo } from '@/storage/repos/books';
import { pagesRepo } from '@/storage/repos/pages';
import { charactersRepo } from '@/storage/repos/characters';
import { useBlobUrl } from '@/ui/useBlobUrl';
import { PageView } from '../PageView';
import { advanceDelay, swipeDirection } from './timing';
export default function Player() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [pages, setPages] = useState<Page[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [ended, setEnded] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const [holding, setHolding] = useState(false);
  const [settled, setSettled] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const host = useRef<HTMLElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>();
  const down = useRef<number>();
  const turnLock = useRef(false);
  const page = pages[index];
  const url = useBlobUrl(page?.narrationBlobId);
  const exit = useCallback(() => {
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(console.warn);
    navigate('/');
  }, [navigate]);
  useEffect(() => {
    let active = true;
    if (id)
      void Promise.all([
        booksRepo.get(id),
        pagesRepo.listByBook(id),
        charactersRepo.listByRecency(),
      ])
        .then(([book, rows, chars]) => {
          if (!active) return;
          if (!book || !rows.length) {
            navigate(`/books/${id}/edit`, { replace: true });
            return;
          }
          setPages(rows);
          setCharacters(chars);
          setLoaded(true);
        })
        .catch((error) => {
          console.warn(error);
          if (active) navigate('/');
        });
    return () => {
      active = false;
      clearTimeout(holdTimer.current);
    };
  }, [id, navigate]);
  useEffect(() => {
    const root = host.current;
    void root?.requestFullscreen?.().catch(() => undefined);
    let lock: WakeLockSentinel | undefined;
    let disposed = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const next = await navigator.wakeLock?.request('screen');
        if (disposed) await next?.release();
        else lock = next;
      } catch {
        /* Feature is optional; playback remains available. */
      }
    };
    const visibility = () => {
      if (document.visibilityState === 'visible') void acquire();
      else {
        void lock?.release();
        lock = undefined;
      }
    };
    void acquire();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      disposed = true;
      void lock?.release();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  const next = useCallback(() => {
    if (turnLock.current) return;
    turnLock.current = true;
    setSettled(false);
    setEnded(false);
    setAudioFailed(false);
    setIndex(Math.min(pages.length, index + 1));
    setTimeout(() => {
      turnLock.current = false;
    }, 350);
  }, [pages.length, index]);
  useEffect(() => {
    const element = audio.current;
    const timer = setTimeout(() => setSettled(true), 300);
    return () => {
      clearTimeout(timer);
      if (element) {
        element.pause();
        element.currentTime = 0;
      }
    };
  }, [index]);
  useEffect(() => {
    if (!settled || !url || !page?.narrationBlobId) return;
    const element = audio.current;
    const timer = setTimeout(() => {
      if (element) void element.play().catch(() => setAudioFailed(true));
    }, 300);
    return () => {
      clearTimeout(timer);
      element?.pause();
    };
  }, [settled, url, page?.narrationBlobId]);
  useEffect(() => {
    if (!settled || !page) return;
    const delay = advanceDelay(
      page.advance,
      !!page.narrationBlobId && !audioFailed,
      ended,
    );
    if (delay === null) return;
    const timer = setTimeout(next, delay);
    return () => clearTimeout(timer);
  }, [page, settled, ended, audioFailed, next]);
  const moveTo = (nextIndex: number) => {
    const target = Math.max(0, Math.min(pages.length, nextIndex));
    if (target === index) return;
    setSettled(false);
    setEnded(false);
    setAudioFailed(false);
    setIndex(target);
  };
  const startHold = () => {
    clearTimeout(holdTimer.current);
    setHolding(true);
    holdTimer.current = setTimeout(() => {
      navigator.vibrate?.(40);
      exit();
    }, 1000);
  };
  const stopHold = () => {
    clearTimeout(holdTimer.current);
    setHolding(false);
  };
  return (
    <main className="player" ref={host}>
      {!loaded ? (
        <p role="status">{t('loading')}</p>
      ) : page ? (
        <>
          <button
            className="player-turn"
            aria-label={t('nextPage')}
            onClick={(event) => {
              if (event.detail === 0) next();
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') {
                event.preventDefault();
                next();
              }
              if (event.key === 'ArrowLeft') {
                event.preventDefault();
                moveTo(index - 1);
              }
            }}
            onPointerDown={(event) => {
              down.current = event.clientX;
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerUp={(event) => {
              const direction = swipeDirection(
                event.clientX - (down.current ?? event.clientX),
                event.currentTarget.clientWidth,
              );
              down.current = undefined;
              if (direction < 0) moveTo(index - 1);
              else next();
            }}
            onPointerCancel={() => {
              down.current = undefined;
            }}
          />
          <PageView
            key={page.id}
            page={page}
            character={characters.find(
              (character) => character.id === page.characterId,
            )}
            mode="play"
            playing={settled}
          />
          {url && (
            // User-recorded narration has the author's visible page text as its text alternative.
            // Automatic transcription is outside the offline MVP; no fabricated caption track.
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio
              ref={audio}
              src={url}
              onEnded={() => setEnded(true)}
              onError={() => setAudioFailed(true)}
            />
          )}
          <div
            className="page-dots"
            role="status"
            aria-label={t('page', { number: index + 1 })}
          >
            {pages.map((page, number) => (
              <span
                key={page.id}
                className={number === index ? 'active' : ''}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="ending">
          <h1>{t('ending')}</h1>
          <div className="actions">
            <button
              onClick={() => {
                turnLock.current = false;
                moveTo(0);
              }}
            >
              {t('replay')}
            </button>
          </div>
        </div>
      )}
      <button
        className={`exit-button ${holding ? 'holding' : ''}`}
        onPointerDown={(event) => {
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          startHold();
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          stopHold();
        }}
        onPointerCancel={stopHold}
        onPointerLeave={stopHold}
        onKeyDown={(event) => {
          if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) {
            event.preventDefault();
            startHold();
          }
        }}
        onKeyUp={stopHold}
        onBlur={stopHold}
      >
        {t('holdExit')}
      </button>
    </main>
  );
}
