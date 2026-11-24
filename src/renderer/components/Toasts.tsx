import type { ToastMessage } from '../../shared/types/app';

interface ToastsProps {
  toasts: ToastMessage[];
}

const styles: Record<ToastMessage['variant'], string> = {
  info: 'bg-slate-800 text-white',
  success: 'bg-emerald-700 text-white',
  error: 'bg-rose-700 text-white',
};

export function Toasts({ toasts }: ToastsProps) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} className={`max-w-xl rounded-md px-4 py-2 text-sm shadow-lg ${styles[toast.variant]}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
