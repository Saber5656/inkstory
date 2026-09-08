import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
export function Dialog({
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel,
  busy = false,
}: {
  title: string;
  children?: ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useTranslation();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else onClose();
      }}
    >
      <h2 id="dialog-title">{title}</h2>
      <div>{children}</div>
      <div className="actions">
        <button disabled={busy} onClick={onClose}>
          {t('cancel')}
        </button>
        {onConfirm && (
          <button disabled={busy} className="primary" onClick={onConfirm}>
            {confirmLabel ?? t('next')}
          </button>
        )}
      </div>
    </dialog>
  );
}
