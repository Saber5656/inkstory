import {
  useMotionPreference,
  setMotionPreference,
} from '@/ui/motionPreference';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { Book, Character } from '@/domain/types';
import {
  charactersRepo,
  booksRepo,
  settingsRepo,
  requestPersistence,
  getUsage,
} from '@/storage';
import { exportBundle } from '@/exchange/export';
import {
  prepareImport,
  commitImport,
  type PreparedImport,
} from '@/exchange/import';
import { Dialog } from '@/ui/Dialog';
import { ensureSamples } from '@/samples/seed';
export default function Settings() {
  const reducedMotion = useMotionPreference();
  const { t, i18n } = useTranslation();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [sampleIds, setSampleIds] = useState<string[]>([]);
  const [includeSamples, setIncludeSamples] = useState(false);
  const [usage, setUsage] = useState<{
    usage: number | null;
    quota: number | null;
  }>();
  const [persistent, setPersistent] = useState(false);
  const [preview, setPreview] = useState<PreparedImport>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let alive = true;
    void Promise.all([
      charactersRepo.listByRecency(),
      booksRepo.listByRecency(),
      settingsRepo.get('samples.ids'),
      getUsage(),
      navigator.storage?.persisted?.() ?? Promise.resolve(false),
    ])
      .then(([chars, stories, samples, used, persisted]) => {
        if (!alive) return;
        const ids = Array.isArray(samples?.value)
          ? samples.value.filter(
              (value): value is string => typeof value === 'string',
            )
          : [];
        setCharacters(chars);
        setBooks(stories);
        setSampleIds(ids);
        setSelected(
          [...chars, ...stories]
            .map((value) => value.id)
            .filter((id) => !ids.includes(id)),
        );
        setUsage(used);
        setPersistent(persisted);
      })
      .catch(() => setError(t('error')));
    return () => {
      alive = false;
    };
  }, [t]);
  async function backup() {
    setBusy(true);
    setError('');
    try {
      const blob = await exportBundle({
        characterIds: characters
          .filter((c) => selected.includes(c.id))
          .map((c) => c.id),
        bookIds: books.filter((b) => selected.includes(b.id)).map((b) => b.id),
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inkstory-${new Date().toISOString().slice(0, 10)}.inkstory`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.warn(error);
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  }
  async function read(file: File | undefined) {
    if (!file) return;
    setStatus('');
    setPreview(undefined);
    setBusy(true);
    setError('');
    try {
      setPreview(await prepareImport(file));
    } catch (error) {
      setError(error instanceof Error ? error.message : t('error'));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }
  async function importPrepared() {
    if (!preview || busy) return;
    setStatus('');
    setBusy(true);
    try {
      await commitImport(preview);
      setPreview(undefined);
      setStatus(t('importDone'));
      setCharacters(await charactersRepo.listByRecency());
      setBooks(await booksRepo.listByRecency());
    } catch (error) {
      setError(error instanceof Error ? error.message : t('error'));
    } finally {
      setBusy(false);
    }
  }
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  return (
    <main className="narrow">
      <h1>{t('settings')}</h1>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      <section className="paper">
        <label>
          {t('language')}
          <select
            value={i18n.language}
            onChange={(event) => {
              void i18n.changeLanguage(event.target.value);
              void settingsRepo.set('locale', event.target.value);
            }}
          >
            <option value="ja">{t('japanese')}</option>
            <option value="en">{t('english')}</option>
          </select>
        </label>
        <label>
          {t('reducedMotion')}
          <select
            value={
              reducedMotion === undefined ? 'system' : String(reducedMotion)
            }
            onChange={(event) => {
              void setMotionPreference(
                event.target.value === 'system'
                  ? undefined
                  : event.target.value === 'true',
              ).catch(() => setError(t('error')));
            }}
          >
            <option value="system">{t('systemPreference')}</option>
            <option value="true">{t('reduce')}</option>
            <option value="false">{t('fullMotion')}</option>
          </select>
        </label>
        <p>
          {t('version')} {import.meta.env.VITE_APP_VERSION ?? '0.1.0'}
        </p>
      </section>
      <section className="paper">
        <h2>{t('storage')}</h2>
        <p>{t('storageHint')}</p>
        <p>
          {t('persistent')}: {t(persistent ? 'yes' : 'no')}
        </p>
        {usage && (
          <p className="small">
            {t('storageUsage', {
              used:
                usage.usage === null
                  ? t('unknown')
                  : Math.round(usage.usage / 1024 / 1024),
              total:
                usage.quota === null
                  ? t('unknown')
                  : Math.round(usage.quota / 1024 / 1024),
            })}
          </p>
        )}
        <button
          onClick={() => {
            void requestPersistence()
              .then(setPersistent)
              .catch(() => setError(t('error')));
          }}
        >
          {t('protectStorage')}
        </button>
        <h3>{t('export')}</h3>
        <label className="check">
          <input
            type="checkbox"
            checked={includeSamples}
            onChange={(e) => {
              const checked = e.target.checked;
              setIncludeSamples(checked);
              setSelected((current) =>
                checked
                  ? [...new Set([...current, ...sampleIds])]
                  : current.filter((id) => !sampleIds.includes(id)),
              );
            }}
          />
          {t('includeSamples')}
        </label>
        {[...characters, ...books]
          .filter((item) => includeSamples || !sampleIds.includes(item.id))
          .map((item) => (
            <label className="check" key={item.id}>
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => toggle(item.id)}
              />
              {'name' in item ? item.name : item.title}
            </label>
          ))}
        <div className="actions">
          <button
            className="primary"
            disabled={busy || !selected.length}
            onClick={() => {
              void backup();
            }}
          >
            {t('export')}
          </button>
          <button disabled={busy} onClick={() => input.current?.click()}>
            {t('import')}
          </button>
          <input
            className="file-input"
            ref={input}
            data-testid="import-input"
            type="file"
            accept=".inkstory,application/zip"
            onChange={(event) => {
              void read(event.target.files?.[0]);
            }}
          />
        </div>
        {busy && <p role="status">{t('loading')}</p>}
      </section>
      <section className="paper">
        <h2>{t('install')}</h2>
        <p>{t('installHint')}</p>
        <button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void ensureSamples(i18n.language === 'en' ? 'en' : 'ja', true)
              .then(async () => {
                setStatus(t('saved'));
                setCharacters(await charactersRepo.listByRecency());
                setBooks(await booksRepo.listByRecency());
                const record = await settingsRepo.get('samples.ids');
                const ids = Array.isArray(record?.value)
                  ? record.value.filter(
                      (value): value is string => typeof value === 'string',
                    )
                  : [];
                setSampleIds(ids);
                if (includeSamples)
                  setSelected((current) => [...new Set([...current, ...ids])]);
              })
              .catch(() => setError(t('error')))
              .finally(() => setBusy(false));
          }}
        >
          {t('restoreSamples')}
        </button>
      </section>
      <section className="paper">
        <h2>{t('diagnostics')}</h2>
        <dl>
          <dt>{t('isolation')}</dt>
          <dd>{String(globalThis.crossOriginIsolated ?? false)}</dd>
          <dt>{t('gpu')}</dt>
          <dd>{'gpu' in navigator ? t('yes') : t('no')}</dd>
          <dt>{t('poseStatus')}</dt>
          <dd>{t('manualPose')}</dd>
        </dl>
      </section>
      <Link to="/about">{t('about')}</Link>
      {preview && (
        <Dialog
          title={t('importTitle')}
          busy={busy}
          onClose={() => setPreview(undefined)}
          onConfirm={() => {
            void importPrepared();
          }}
          confirmLabel={t('import')}
        >
          <p>
            {t('importSummary', {
              characters: preview.preview.characterCount,
              books: preview.preview.bookCount,
            })}
          </p>
          <ul>
            {preview.preview.bookTitles.map((title, index) => (
              <li key={index}>{title}</li>
            ))}
          </ul>
        </Dialog>
      )}
    </main>
  );
}
