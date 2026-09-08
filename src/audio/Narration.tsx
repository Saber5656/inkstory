import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/ui/Dialog';
import { useBlobUrl } from '@/ui/useBlobUrl';
import { startRecording, type RecordingSession } from './recorder';
import { createLevelMeter } from './levelMeter';
export function Narration({
  blobId,
  onSave,
  onDelete,
}: {
  blobId?: string;
  onSave: (blob: Blob, mime: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const url = useBlobUrl(blobId);
  const [explainer, setExplainer] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const session = useRef<RecordingSession>();
  const alive = useRef(true);
  const generation = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      session.current?.cancel();
    };
  }, []);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(
      () => setSeconds((value) => Math.min(60, value + 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [recording]);
  async function record() {
    setExplainer(false);
    setError('');
    const token = ++generation.current;
    try {
      const active = await startRecording();
      if (!alive.current || generation.current !== token) {
        active.cancel();
        return;
      }
      session.current = active;
      setRecording(true);
      setSeconds(0);
      let stopMeter = () => {};
      try {
        stopMeter = createLevelMeter(active.stream, setLevel);
        const result = await active.result;
        if (alive.current && generation.current === token && result.blob.size)
          await onSave(result.blob, result.mimeType);
      } finally {
        stopMeter();
        active.cancel();
        session.current = undefined;
        if (alive.current) setRecording(false);
      }
    } catch {
      if (alive.current) {
        setRecording(false);
        setError(t('micDenied'));
      }
    }
  }
  if (typeof MediaRecorder === 'undefined')
    return <p className="small">{t('micUnsupported')}</p>;
  return (
    <section>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {recording ? (
        <>
          <p role="status">{t('recording', { seconds })}</p>
          <meter
            className="level"
            min="0"
            max="1"
            value={level}
            aria-label={t('record')}
          />
          {seconds >= 55 && (
            <p role="status">
              {t('recordCountdown', { seconds: 60 - seconds })}
            </p>
          )}
          <button
            onClick={() => {
              void session.current
                ?.stop()
                .catch(() => setError(t('micDenied')));
            }}
          >
            {t('stop')}
          </button>
        </>
      ) : (
        <>
          <button onClick={() => setExplainer(true)}>
            {t(blobId ? 'recordAgain' : 'record')}
          </button>
          {url && (
            <>
              {/* User-authored offline audio has no automatic transcript; the story is editable beside it. */}
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls src={url} aria-label={t('listen')} />
              <button onClick={() => setConfirmDelete(true)}>
                {t('delete')}
              </button>
            </>
          )}
        </>
      )}
      {explainer && (
        <Dialog
          title={t('micTitle')}
          onClose={() => setExplainer(false)}
          onConfirm={() => {
            void record();
          }}
          confirmLabel={t('micAllow')}
        >
          <p>{t('micBody')}</p>
        </Dialog>
      )}
      {confirmDelete && (
        <Dialog
          title={t('confirmDelete', { name: t('record') })}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => {
            void onDelete()
              .then(() => setConfirmDelete(false))
              .catch(() => setError(t('error')));
          }}
          confirmLabel={t('delete')}
        />
      )}
    </section>
  );
}
