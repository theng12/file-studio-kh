import type { RouteId } from '../App';
import type { RecentRoot, ScanProgress, ScanSummary } from '../../shared/types/app';
import { useI18n } from '../i18n';
import { useState } from 'react';

interface DashboardProps {
  activeRoot: RecentRoot | null;
  recentRoots: RecentRoot[];
  scanBusy: boolean;
  scanProgress: ScanProgress | null;
  summary: ScanSummary | null;
  onChooseFolder: () => Promise<void>;
  onCancelScan: () => Promise<void>;
  onNavigate: (route: RouteId) => void;
  onScanRoot: (root: RecentRoot) => Promise<void>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}

export function Dashboard({ activeRoot, recentRoots, scanBusy, scanProgress, summary, onChooseFolder, onCancelScan, onNavigate, onScanRoot }: DashboardProps) {
  const { t } = useI18n();
  const [supportDismissedUntil, setSupportDismissedUntil] = useState(() => Number(window.localStorage.getItem('file-studio-kh.supportDismissedUntil') ?? '0'));
  const showSupportNudge = Date.now() > supportDismissedUntil;

  function dismissSupportNudge(): void {
    const next = Date.now() + 1000 * 60 * 60 * 24 * 14;
    window.localStorage.setItem('file-studio-kh.supportDismissedUntil', String(next));
    setSupportDismissedUntil(next);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-start justify-between gap-5">
          <div>
            <h2 className="text-base font-semibold">{activeRoot ? activeRoot.label : t('noFolderSelected')}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              {activeRoot
                ? activeRoot.rootPath
                : t('rootFolderHelp')}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-line px-4 py-2 text-sm font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              onClick={() => void onChooseFolder()}
            >
              {t('chooseFolder')}
            </button>
            <button
              type="button"
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!activeRoot || scanBusy}
              onClick={() => activeRoot ? void onScanRoot(activeRoot) : undefined}
            >
              {t('rescan')}
            </button>
            {scanBusy && (
              <button
                type="button"
                className="rounded-md border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950"
                onClick={() => void onCancelScan()}
              >
                {t('cancel')}
              </button>
            )}
          </div>
        </div>
      </section>

      {scanBusy && scanProgress && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <div className="flex items-center justify-between gap-4 text-sm">
            <div className="min-w-0">
              <div className="font-semibold text-amber-950 dark:text-amber-100">{scanProgress.message}</div>
              <div className="mt-1 truncate text-amber-800 dark:text-amber-200">{scanProgress.currentPath}</div>
            </div>
            <div className="shrink-0 text-right text-amber-950 dark:text-amber-100">
              <div>{scanProgress.fileCount.toLocaleString()} {t('files')}</div>
              <div>{scanProgress.folderCount.toLocaleString()} {t('folders')}</div>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        {[
          [t('files'), summary?.fileCount.toLocaleString() ?? '0'],
          [t('folders'), summary?.folderCount.toLocaleString() ?? '0'],
          [t('messyFiles'), summary?.messyCount.toLocaleString() ?? '0'],
          [t('totalSize'), summary ? formatBytes(summary.totalBytes) : '0 B'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">{label}</div>
            <div className="mt-2 text-2xl font-semibold">{value}</div>
          </div>
        ))}
      </section>

      {summary && summary.warnings.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">Scan warnings</h3>
          <div className="mt-3 space-y-2">
            {summary.warnings.map((warning) => (
              <div key={warning} className="text-sm text-amber-800 dark:text-amber-200">{warning}</div>
            ))}
          </div>
        </section>
      )}

      {showSupportNudge && summary && (
        <section className="rounded-lg border border-line bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold">File Studio KH is free, with all features unlocked.</h3>
              <p className="mt-1 text-sm text-neutral-500">If it saves time in your cleanup workflow, voluntary support helps keep builds moving.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                onClick={() => onNavigate('support')}
              >
                {t('supportThisApp')}
              </button>
              <button
                type="button"
                className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                onClick={dismissSupportNudge}
              >
                Not now
              </button>
            </div>
          </div>
        </section>
      )}

      {summary && (
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-line bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="text-sm font-semibold">{t('fileTypes')}</h3>
            <div className="mt-3 space-y-2">
              {summary.byType.map((item) => (
                <div key={item.fileType} className="flex justify-between text-sm">
                  <span className="capitalize text-neutral-500">{item.fileType}</span>
                  <span className="font-medium">{item.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="text-sm font-semibold">{t('topExtensions')}</h3>
            <div className="mt-3 space-y-2">
              {summary.byExtension.slice(0, 8).map((item) => (
                <div key={item.extension} className="flex justify-between text-sm">
                  <span className="text-neutral-500">{item.extension}</span>
                  <span className="font-medium">{item.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="text-sm font-semibold">{t('recentFiles')}</h3>
            <div className="mt-3 space-y-2">
              {summary.recentFiles.slice(0, 6).map((file) => (
                <div key={file.id} className="truncate text-sm text-neutral-500" title={file.relativePath}>
                  {file.relativePath}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {recentRoots.length > 0 && (
        <section className="rounded-lg border border-line bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="text-sm font-semibold">{t('recentFolders')}</h3>
          <div className="mt-3 space-y-2">
            {recentRoots.map((root) => (
              <button
                key={root.id}
                type="button"
                className="block w-full truncate rounded-md px-3 py-2 text-left text-sm text-neutral-600 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
                onClick={() => void onScanRoot(root)}
                title={root.rootPath}
              >
                {root.rootPath}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
