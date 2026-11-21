import { useEffect, useState } from 'react';
import type { AppInfo, AppSettings, CacheStats } from '../../shared/types/app';
import { useI18n } from '../i18n';

interface SettingsProps {
  info: AppInfo;
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => Promise<void>;
}

function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-4 border-b border-line py-4 last:border-b-0 dark:border-neutral-800 md:grid-cols-[220px_minmax(0,1fr)]">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        <div className="mt-1 text-sm leading-5 text-neutral-500">{description}</div>
      </div>
      <div className="flex items-center justify-end">{children}</div>
    </div>
  );
}

export function Settings({ info, settings, onUpdate }: SettingsProps) {
  const { t } = useI18n();
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [cacheBusy, setCacheBusy] = useState(false);
  const [trashBusy, setTrashBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  useEffect(() => {
    void window.api.thumbnails.getCacheStats().then(setCacheStats);
  }, []);

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  async function updateCacheLimit(value: number): Promise<void> {
    await onUpdate({ thumbnailCacheLimitMb: value });
    const stats = await window.api.thumbnails.enforceCacheLimit();
    setCacheStats(stats);
  }

  async function clearCache(): Promise<void> {
    setCacheBusy(true);
    try {
      const stats = await window.api.thumbnails.clearCache();
      setCacheStats(stats);
    } finally {
      setCacheBusy(false);
    }
  }

  async function chooseTrashFolder(): Promise<void> {
    setTrashBusy(true);
    try {
      const folder = await window.api.folders.pickDirectory('Choose custom _trash location');
      if (folder) await onUpdate({ trashLocationMode: 'custom', customTrashPath: folder });
    } finally {
      setTrashBusy(false);
    }
  }

  async function chooseSaveFolder(): Promise<void> {
    setSaveBusy(true);
    try {
      const folder = await window.api.folders.pickDirectory('Choose default save location');
      if (folder) await onUpdate({ defaultSaveLocation: folder });
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-white px-5 dark:border-neutral-800 dark:bg-neutral-900">
        <SettingRow label={t('theme')} description="Default is Light. System follows the OS setting after you choose it.">
          <div className="inline-flex rounded-md border border-line p-1 dark:border-neutral-700">
            {(['light', 'dark', 'system'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                title={`Use ${mode} theme`}
                className={`rounded px-3 py-1.5 text-sm font-medium capitalize ${
                  settings.theme === mode ? 'bg-accent text-white' : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
                onClick={() => void onUpdate({ theme: mode })}
              >
                {t(mode)}
              </button>
            ))}
          </div>
        </SettingRow>

        <SettingRow label={t('language')} description="Only maintained languages are shown.">
          <select
            className="h-9 rounded-md border border-line bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            value={settings.uiLanguage}
            onChange={(event) => void onUpdate({ uiLanguage: event.target.value as AppSettings['uiLanguage'] })}
          >
            <option value="en">English</option>
            <option value="km">ខ្មែរ (Khmer)</option>
          </select>
        </SettingRow>

        <SettingRow label="Scan depth" description="Limits recursive scanning for very deep folders.">
          <input
            className="h-9 w-24 rounded-md border border-line bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            type="number"
            min={1}
            max={20}
            value={settings.scanDepth}
            onChange={(event) => void onUpdate({ scanDepth: Number(event.target.value) })}
          />
        </SettingRow>

        <SettingRow label="Hidden files" description="Dotfiles and hidden folders can be noisy in media libraries.">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.includeHidden}
              onChange={(event) => void onUpdate({ includeHidden: event.target.checked })}
            />
            Include hidden files and folders
          </label>
        </SettingRow>

        <SettingRow label="Ignored folders" description="Comma-separated folder names skipped during scans. `_trash` is always treated as soft trash.">
          <input
            className="h-9 w-full max-w-xl rounded-md border border-line bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            value={settings.ignoredFolderNames}
            onChange={(event) => void onUpdate({ ignoredFolderNames: event.target.value })}
            placeholder="_trash,node_modules,.git"
          />
        </SettingRow>

        <SettingRow label={t('projectLog')} description="Optionally mirror operation history into the selected root.">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.enableProjectLocalLog}
              onChange={(event) => void onUpdate({ enableProjectLocalLog: event.target.checked })}
            />
            Write `.file-studio-kh/actions.jsonl`
          </label>
        </SettingRow>

        <SettingRow label="Save location" description="Default location for future exports and support bundles. This does not move source files.">
          <div className="flex w-full max-w-2xl items-center justify-end gap-2">
            <div className="min-w-0 flex-1 truncate rounded-md border border-line bg-neutral-50 px-3 py-2 text-right text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
              {settings.defaultSaveLocation}
            </div>
            <button
              type="button"
              className="shrink-0 rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
              disabled={saveBusy}
              onClick={() => void chooseSaveFolder()}
            >
              {saveBusy ? 'Choosing...' : t('choose')}
            </button>
          </div>
        </SettingRow>

        <SettingRow label={t('trashLocation')} description="Default keeps soft-deleted files in `_trash` inside the selected root. Custom keeps one project-named subfolder per root.">
          <div className="flex w-full max-w-2xl flex-col items-end gap-3">
            <div className="inline-flex rounded-md border border-line p-1 dark:border-neutral-700">
              <button
                type="button"
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  settings.trashLocationMode === 'insideRoot' ? 'bg-accent text-white' : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
                onClick={() => void onUpdate({ trashLocationMode: 'insideRoot' })}
              >
                {t('insideRoot')}
              </button>
              <button
                type="button"
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  settings.trashLocationMode === 'custom' ? 'bg-accent text-white' : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
                onClick={() => void onUpdate({ trashLocationMode: 'custom' })}
              >
                {t('custom')}
              </button>
            </div>
            {settings.trashLocationMode === 'custom' && (
              <div className="flex w-full items-center justify-end gap-2">
                <div className="min-w-0 flex-1 truncate rounded-md border border-line bg-neutral-50 px-3 py-2 text-right text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                  {settings.customTrashPath || 'No custom folder selected'}
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  disabled={trashBusy}
                  onClick={() => void chooseTrashFolder()}
                >
                  {trashBusy ? 'Choosing...' : t('choose')}
                </button>
              </div>
            )}
          </div>
        </SettingRow>

        <SettingRow label={t('thumbnailCache')} description="Cached previews live in app data, never in selected folders.">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="text-right text-sm text-neutral-500">
              <div>{cacheStats ? `${formatBytes(cacheStats.sizeBytes)} / ${formatBytes(cacheStats.limitBytes)}` : 'Loading cache...'}</div>
              <div>{cacheStats ? `${cacheStats.fileCount.toLocaleString()} thumbnails` : ''}</div>
            </div>
            <input
              className="h-9 w-28 rounded-md border border-line bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              type="number"
              min={128}
              max={10240}
              step={128}
              value={settings.thumbnailCacheLimitMb}
              onChange={(event) => void updateCacheLimit(Number(event.target.value))}
              aria-label="Thumbnail cache limit in MB"
            />
            <span className="text-sm text-neutral-500">MB</span>
            <button
              type="button"
              className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
              disabled={cacheBusy}
              onClick={() => void clearCache()}
            >
              {cacheBusy ? 'Clearing...' : t('clearCache')}
            </button>
          </div>
        </SettingRow>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-start justify-between gap-5">
          <div>
            <h2 className="text-base font-semibold">About File Studio KH</h2>
            <p className="mt-1 text-sm text-neutral-500">Local-first folder organization for product images and mixed media.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <div className="rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-semibold dark:bg-neutral-800">v{info.version}</div>
            <div className="rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-semibold dark:bg-neutral-800">
              {info.isPackaged ? 'Packaged' : 'Development'}
            </div>
          </div>
        </div>
        <dl className="mt-5 grid gap-3 text-sm md:grid-cols-4">
          <div><dt className="text-neutral-500">Platform</dt><dd className="font-medium">{info.platform}</dd></div>
          <div><dt className="text-neutral-500">Electron</dt><dd className="font-medium">{info.electron}</dd></div>
          <div><dt className="text-neutral-500">Chromium</dt><dd className="font-medium">{info.chromium}</dd></div>
          <div><dt className="text-neutral-500">Node</dt><dd className="font-medium">{info.node}</dd></div>
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            onClick={() => setUpdateMessage(
              info.isPackaged
                ? 'Updates come through the Studio Updater, which reads the shared feed and installs a newer File Studio KH. The app pauses new scans and applies first, and resumes by itself.'
                : 'This is a development build; it is not updated by the Updater.',
            )}
          >
            How updates work
          </button>
          {updateMessage && <div className="text-sm text-neutral-500">{updateMessage}</div>}
        </div>
      </section>
    </div>
  );
}
