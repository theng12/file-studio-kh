import { useEffect, useRef } from 'react';
import { IconClose } from './icons';
import { useI18n } from '../i18n';

interface ModalProps {
  title: string;
  open: boolean;
  closeOnBackdrop?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ title, open, closeOnBackdrop = true, onClose, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return undefined;

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-black/35 p-6"
      onMouseDown={() => {
        if (closeOnBackdrop) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className="flex max-h-[calc(100vh-3rem)] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl outline-none dark:bg-neutral-900"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4 dark:border-neutral-800">
          <h2 id="modal-title" className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            aria-label={t('closeEsc')}
            title={t('closeEsc')}
            className="grid size-8 place-items-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-50"
            onClick={onClose}
          >
            <IconClose className="size-4" />
          </button>
        </div>
        <div className="min-h-0 overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}
