import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
export function Camera({
  stream,
  onClose,
  onCapture,
}: {
  stream: MediaStream;
  onClose: () => void;
  onCapture: (file: File) => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = video.current;
    const modal = dialog.current;
    modal?.showModal();
    if (element) {
      element.srcObject = stream;
      void element.play().catch(onClose);
    }
    return () => {
      stream.getTracks().forEach((track) => track.stop());
      if (element) element.srcObject = null;
      modal?.close();
    };
  }, [stream, onClose]);
  function shutter() {
    const element = video.current;
    if (!element?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    canvas.getContext('2d')?.drawImage(element, 0, 0);
    canvas.toBlob((blob) => {
      if (blob)
        onCapture(new File([blob], 'camera.png', { type: 'image/png' }));
    }, 'image/png');
  }
  return (
    <dialog ref={dialog} onCancel={onClose} aria-labelledby="camera-title">
      <h2 id="camera-title">{t('photo')}</h2>
      <p>{t('privacyShort')}</p>
      <video ref={video} autoPlay muted playsInline aria-label={t('photo')} />
      <div className="actions">
        <button onClick={onClose}>{t('cancel')}</button>
        <button className="primary" onClick={shutter}>
          {t('photo')}
        </button>
      </div>
    </dialog>
  );
}
