import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { onStorageFull } from '@/storage/quota';
import { Dialog } from '@/ui/Dialog';
export function Updates() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const [full, setFull] = useState(false);
  const safe =
    pathname === '/' || pathname === '/settings' || pathname === '/about';
  useEffect(() => {
    return onStorageFull(() => setFull(true));
  }, []);
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    let active = true;
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => {
        // Headerless static hosts need one controlled navigation before COI is active.
        if (
          import.meta.env.VITE_COI === 'sw' &&
          !globalThis.crossOriginIsolated &&
          safe
        ) {
          void navigator.serviceWorker.ready.then(() => {
            const key = 'inkstory.coi.reloaded';
            if (active && !sessionStorage.getItem(key)) {
              sessionStorage.setItem(key, '1');
              location.reload();
            }
          });
        }
        if (reg.waiting && active) setRegistration(reg);
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          worker?.addEventListener('statechange', () => {
            if (
              worker.state === 'installed' &&
              navigator.serviceWorker.controller &&
              active
            )
              setRegistration(reg);
          });
        });
      })
      .catch(console.warn);
    return () => {
      active = false;
    };
  }, [safe]);
  return (
    <>
      {registration && safe && (
        <aside className="welcome" role="status">
          <p>{t('newVersion')}</p>
          <button
            onClick={() => {
              navigator.serviceWorker.addEventListener(
                'controllerchange',
                () => location.reload(),
                { once: true },
              );
              registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
            }}
          >
            {t('applyUpdate')}
          </button>
          <button onClick={() => setRegistration(undefined)}>
            {t('close')}
          </button>
        </aside>
      )}
      {full && (
        <Dialog title={t('storageFull')} onClose={() => setFull(false)}>
          <p>{t('storageFullBody')}</p>
          <a href={`${import.meta.env.BASE_URL}settings`}>{t('export')}</a>
        </Dialog>
      )}
    </>
  );
}
