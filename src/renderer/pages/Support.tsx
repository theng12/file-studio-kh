import type { ToastMessage } from '../../shared/types/app';

const NOWPAYMENTS_DONATION_URL = 'https://nowpayments.io/donation/studiokh';

interface SupportProps {
  onToast: (variant: ToastMessage['variant'], message: string) => void;
}

export function Support({ onToast }: SupportProps) {
  async function openDonation(): Promise<void> {
    try {
      await window.api.app.openExternal(NOWPAYMENTS_DONATION_URL);
    } catch (error) {
      onToast('error', error instanceof Error ? error.message : 'Could not open donation page');
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border border-line bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-lg font-semibold">File Studio KH is free, with all features unlocked.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
          If it saves you hours each week, you can support development with a one-time donation. Donations keep the app maintained, the bugs fixed, and the bundled tooling current.
        </p>
      </section>

      <section className="rounded-lg border border-line bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-base font-semibold">Donate</h2>
        <button
          type="button"
          className="mt-4 w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          onClick={() => void openDonation()}
        >
          Pay with crypto
        </button>
        <p className="mt-3 text-sm leading-6 text-neutral-500">
          Opens NOWPayments in your default browser.
        </p>
      </section>
    </div>
  );
}
