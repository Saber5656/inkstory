import { lazy, Suspense } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '@/i18n/setup';
import { Updates } from '@/pwa/Updates';
const Library = lazy(() => import('./screens/Library'));
const Wizard = lazy(() => import('./wizard/Wizard'));
const Stage = lazy(() => import('./screens/Stage'));
const Editor = lazy(() => import('@/book/Editor'));
const Player = lazy(() => import('@/book/player/Player'));
const Settings = lazy(() => import('./screens/Settings'));
const About = lazy(() => import('./screens/About'));
export function Shell() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const player = /\/books\/[^/]+\/play$/.test(pathname);
  return (
    <>
      {!player && (
        <header className="site-header">
          <Link className="brand" to="/" aria-label={t('home')}>
            <span className="brand-mark" aria-hidden="true">
              ✳
            </span>
            {t('appName')}
          </Link>
          <nav>
            <Link to="/">{t('library')}</Link>
            <Link to="/settings" aria-label={t('settings')}>
              ⚙
            </Link>
          </nav>
        </header>
      )}
      {!player && <Updates />}
      <Suspense
        fallback={
          <main className="empty" role="status">
            {t('loading')}
          </main>
        }
      >
        <Routes>
          <Route path="/" element={<Library />} />
          <Route path="/characters/new" element={<Wizard />} />
          <Route path="/characters/:id" element={<Stage />} />
          <Route path="/books/:id/edit" element={<Editor />} />
          <Route path="/books/:id/play" element={<Player />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
          <Route
            path="*"
            element={
              <main className="empty">
                <h1>{t('notFound')}</h1>
                <Link to="/">{t('home')}</Link>
              </main>
            }
          />
        </Routes>
      </Suspense>
    </>
  );
}
