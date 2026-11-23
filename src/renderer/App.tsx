import { useEffect, useMemo, useState } from 'react';
import changelogRaw from '../../CHANGELOG.md?raw';
import type { ActionPreviewResult, AppInfo, AppSettings, FileListQuery, FileListResult, FolderTreeItem, RecentRoot, ScanProgress, ScanSummary, TagSummary, ToastMessage } from '../shared/types/app';
import { Modal } from './components/Modal';
import { Sidebar } from './components/Sidebar';
import { Toasts } from './components/Toasts';
import { Dashboard } from './pages/Dashboard';
import { Files } from './pages/Files';
import { Actions } from './pages/Actions';
import { History } from './pages/History';
import { Advanced } from './pages/Advanced';
import { Settings } from './pages/Settings';
import { Support } from './pages/Support';
import { I18nProvider, translate } from './i18n';

export type RouteId = 'dashboard' | 'files' | 'actions' | 'history' | 'advanced' | 'settings' | 'support';

const LAST_SEEN_CHANGELOG_KEY = 'fskh.lastSeenVersion';

function resolveTheme(mode: AppSettings['theme']): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return mode;
}

function applyTheme(mode: AppSettings['theme']): void {
  document.documentElement.classList.toggle('dark', resolveTheme(mode) === 'dark');
}

function parseCurrentChangelog(version: string): string {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = changelogRaw.match(new RegExp(`## \\[${escaped}\\][\\s\\S]*?(?=\\n## \\[|$)`));
  return match?.[0]?.trim() ?? changelogRaw.trim();
}

export default function App() {
  const [route, setRoute] = useState<RouteId>('dashboard');
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [recentRoots, setRecentRoots] = useState<RecentRoot[]>([]);
  const [activeRoot, setActiveRoot] = useState<RecentRoot | null>(null);
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);
  const [folderTree, setFolderTree] = useState<FolderTreeItem[]>([]);
  const [scanTags, setScanTags] = useState<TagSummary[]>([]);
  const [fileList, setFileList] = useState<FileListResult>({ files: [], total: 0, limit: 50, offset: 0 });
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [actionPreviewHandoff, setActionPreviewHandoff] = useState<ActionPreviewResult | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanStatus, setScanStatus] = useState('Idle');
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [watchEvent, setWatchEvent] = useState<{ rootPath: string; eventType: string; filename: string; happenedAt: string } | null>(null);
  const [manualWhatsNewOpen, setManualWhatsNewOpen] = useState(false);
  const [autoWhatsNewOpen, setAutoWhatsNewOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [updateHoldFault, setUpdateHoldFault] = useState<string | null>(null);

  useEffect(() => {
    void window.api.app.getInfo().then((next) => {
      setInfo(next);
      if (localStorage.getItem(LAST_SEEN_CHANGELOG_KEY) !== next.version) {
        setAutoWhatsNewOpen(true);
      }
    });

    void window.api.settings.get().then((next) => {
      setSettings(next);
      applyTheme(next.theme);
    });

    void window.api.folders.listRecent().then(async (roots) => {
      setRecentRoots(roots);
      setActiveRoot(roots[0] ?? null);
      try {
        const summary = await window.api.scan.getSummary();
        const matchingRoot = roots.find((root) => root.rootPath === summary.rootPath) ?? roots[0] ?? null;
        setActiveRoot(matchingRoot);
        setScanSummary(summary);
        await loadFolders(summary.batchId);
        await loadTags(summary.batchId);
        await loadFiles({ batchId: summary.batchId, limit: 50, offset: 0 });
      } catch {
        // First run has no scan summary yet.
      }
    });
  }, []);

  useEffect(() => {
    void window.api.app.getUpdateHoldStatus().then((status) => {
      setUpdateHoldFault(status.tokenFault);
    });
  }, []);

  useEffect(() => {
    return window.api.scan.onProgress((progress) => {
      setScanProgress(progress);
      setScanStatus(progress.message);
    });
  }, []);

  useEffect(() => {
    return window.api.scan.onWatchEvent((event) => {
      setWatchEvent(event);
    });
  }, []);

  useEffect(() => {
    if (!activeRoot) return undefined;
    void window.api.scan.watchRoot(activeRoot.rootPath);
    return () => {
      void window.api.scan.unwatchRoot();
    };
  }, [activeRoot?.rootPath]);

  useEffect(() => {
    if (!settings) return undefined;
    document.documentElement.lang = settings.uiLanguage;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => applyTheme(settings.theme);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, [settings]);

  const pageTitle = useMemo(() => {
    const titles: Record<RouteId, Parameters<typeof translate>[1]> = {
      dashboard: 'dashboard',
      files: 'files',
      actions: 'actions',
      history: 'history',
      advanced: 'advanced',
      settings: 'settings',
      support: 'supportThisApp',
    };
    return translate(settings?.uiLanguage, titles[route]);
  }, [route, settings?.uiLanguage]);

  function pushToast(variant: ToastMessage['variant'], message: string): void {
    const id = crypto.randomUUID();
    setToasts((items) => [...items, { id, variant, message }]);
    window.setTimeout(() => {
      setToasts((items) => items.filter((item) => item.id !== id));
    }, 3000);
  }

  async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
    try {
      const next = await window.api.settings.set(patch);
      setSettings(next);
      applyTheme(next.theme);
      pushToast('success', translate(next.uiLanguage, 'allChangesSaved'));
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : translate(settings?.uiLanguage, 'failedToSaveSettings'));
    }
  }

  async function loadFiles(query: FileListQuery): Promise<void> {
    const result = await window.api.files.list(query);
    setFileList(result);
  }

  async function selectMatchingFiles(query: FileListQuery): Promise<void> {
    const ids = await window.api.files.listIds(query);
    setSelectedFileIds(ids);
    pushToast('info', `Selected ${ids.length.toLocaleString()} matching files`);
  }

  async function loadFolders(batchId: string): Promise<void> {
    const folders = await window.api.scan.listFolders(batchId);
    setFolderTree(folders);
  }

  async function loadTags(batchId: string): Promise<void> {
    const tags = await window.api.scan.listTags(batchId);
    setScanTags(tags);
  }

  async function runScan(root: RecentRoot): Promise<void> {
    setScanBusy(true);
    setScanStatus(`Scanning ${root.label}`);
    setScanProgress(null);
    try {
      setActiveRoot(root);
      const summary = await window.api.scan.start(root.rootPath);
      setScanSummary(summary);
      setSelectedFileIds([]);
      setActionPreviewHandoff(null);
      await loadFolders(summary.batchId);
      await loadTags(summary.batchId);
      await loadFiles({ batchId: summary.batchId, limit: 50, offset: 0 });
      const roots = await window.api.folders.listRecent();
      setRecentRoots(roots);
      if (summary.status === 'cancelled') {
        pushToast('info', `Scan cancelled after ${summary.fileCount.toLocaleString()} files`);
      } else if (summary.status === 'failed') {
        pushToast('error', summary.errorMessage ?? 'Scan failed');
      } else {
        pushToast('success', `Scanned ${summary.fileCount.toLocaleString()} files`);
      }
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : 'Scan failed');
    } finally {
      setScanBusy(false);
      setScanStatus('Idle');
    }
  }

  async function cancelScan(): Promise<void> {
    if (!scanProgress?.batchId) return;
    try {
      await window.api.scan.cancel(scanProgress.batchId);
      setScanStatus('Cancelling scan...');
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : 'Could not cancel scan');
    }
  }

  async function chooseFolder(): Promise<void> {
    try {
      const root = await window.api.folders.pickRoot();
      if (!root) return;
      setActiveRoot(root);
      const roots = await window.api.folders.listRecent();
      setRecentRoots(roots);
      await runScan(root);
      setRoute('dashboard');
    } catch (error) {
      pushToast('error', error instanceof Error ? error.message : 'Could not choose folder');
    }
  }

  function closeAutoWhatsNew(): void {
    if (info) localStorage.setItem(LAST_SEEN_CHANGELOG_KEY, info.version);
    setAutoWhatsNewOpen(false);
  }

  return (
    <I18nProvider language={settings?.uiLanguage ?? 'en'}>
    <div className="flex h-screen overflow-hidden bg-mist text-ink dark:bg-neutral-950 dark:text-neutral-100">
      <Sidebar
        activeRoute={route}
        appVersion={info?.version ?? '0.1.0'}
        onNavigate={setRoute}
        onOpenWhatsNew={() => setManualWhatsNewOpen(true)}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-white px-7 dark:border-neutral-800 dark:bg-neutral-900">
          <div>
            <h1 className="text-xl font-semibold">{pageTitle}</h1>
            <p className="max-w-[720px] truncate text-sm text-neutral-500 dark:text-neutral-400">
              {scanBusy ? scanStatus : activeRoot ? activeRoot.rootPath : 'No folder selected'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {scanBusy && (
              <button
                type="button"
                className="rounded-md border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950"
                onClick={() => void cancelScan()}
              >
                {translate(settings?.uiLanguage, 'cancel')}
              </button>
            )}
            <button
              type="button"
              className="rounded-md border border-line px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
              disabled={scanBusy}
              onClick={() => void chooseFolder()}
            >
              {translate(settings?.uiLanguage, 'chooseFolder')}
            </button>
          </div>
        </header>

        {scanBusy && scanProgress && (
          <div className="border-b border-line bg-amber-50 px-7 py-2 text-sm text-amber-950 dark:border-neutral-800 dark:bg-amber-950 dark:text-amber-100">
            <div className="flex items-center justify-between gap-4">
              <span className="truncate">{scanProgress.message}: {scanProgress.currentPath}</span>
              <span className="shrink-0">{scanProgress.fileCount.toLocaleString()} {translate(settings?.uiLanguage, 'files')} / {scanProgress.folderCount.toLocaleString()} {translate(settings?.uiLanguage, 'folders')}</span>
            </div>
          </div>
        )}

        {updateHoldFault && (
          <div className="border-b border-line bg-rose-50 px-7 py-2 text-sm text-rose-950 dark:border-neutral-800 dark:bg-rose-950 dark:text-rose-100">
            <div className="flex items-center justify-between gap-4">
              <span className="truncate">Updates are blocked: {updateHoldFault}</span>
              <span className="shrink-0 text-rose-800 dark:text-rose-200">Fix the update key file and reopen the app.</span>
            </div>
          </div>
        )}

        {!scanBusy && watchEvent && activeRoot && watchEvent.rootPath === activeRoot.rootPath && (
          <div className="border-b border-line bg-teal-50 px-7 py-2 text-sm text-teal-950 dark:border-neutral-800 dark:bg-teal-950 dark:text-teal-100">
            <div className="flex items-center justify-between gap-4">
              <span className="truncate">Folder changed: {watchEvent.filename || activeRoot.rootPath}</span>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800"
                  onClick={() => {
                    setWatchEvent(null);
                    void runScan(activeRoot);
                  }}
                >
                  Rescan now
                </button>
                <button
                  type="button"
                  className="rounded-md border border-teal-200 px-3 py-1.5 text-sm font-semibold hover:bg-white dark:border-teal-800 dark:hover:bg-teal-900"
                  onClick={() => setWatchEvent(null)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={`min-h-0 flex-1 p-7 ${route === 'files' ? 'overflow-hidden' : 'overflow-auto'}`}>
          {route === 'dashboard' && (
            <Dashboard
              activeRoot={activeRoot}
              recentRoots={recentRoots}
              scanBusy={scanBusy}
              scanProgress={scanProgress}
              summary={scanSummary}
              onChooseFolder={chooseFolder}
              onCancelScan={cancelScan}
              onNavigate={setRoute}
              onScanRoot={runScan}
            />
          )}
          {route === 'files' && (
            <Files
              activeRoot={activeRoot}
              files={fileList.files}
              folders={folderTree}
              scanTags={scanTags}
              selectedFileIds={selectedFileIds}
              total={fileList.total}
              limit={fileList.limit}
              offset={fileList.offset}
              scanBusy={scanBusy}
              scanProgress={scanProgress}
              summary={scanSummary}
              onChooseFolder={chooseFolder}
              onCancelScan={cancelScan}
              onLoadFiles={loadFiles}
              onOpenActions={() => setRoute('actions')}
              onRescan={() => activeRoot ? void runScan(activeRoot) : void chooseFolder()}
              onSelectMatching={selectMatchingFiles}
              onSelectionChange={setSelectedFileIds}
            />
          )}
          {route === 'actions' && (
            <Actions
              activeRoot={activeRoot}
              scanSummary={scanSummary}
              selectedFileIds={selectedFileIds}
              initialPreview={actionPreviewHandoff}
              onNavigate={setRoute}
            />
          )}
          {route === 'history' && <History />}
          {route === 'advanced' && (
            <Advanced
              activeRoot={activeRoot}
              scanSummary={scanSummary}
              selectedFileIds={selectedFileIds}
              onSelectionChange={setSelectedFileIds}
              onPreviewReady={setActionPreviewHandoff}
              onNavigateActions={() => setRoute('actions')}
              onToast={pushToast}
            />
          )}
          {route === 'settings' && settings && info && (
            <Settings info={info} settings={settings} onUpdate={updateSettings} />
          )}
          {route === 'support' && <Support onToast={pushToast} />}
        </div>
      </main>

      <Modal
        title={translate(settings?.uiLanguage, 'whatsNew')}
        open={manualWhatsNewOpen}
        onClose={() => setManualWhatsNewOpen(false)}
      >
        <pre className="whitespace-pre-wrap rounded-md bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
          {changelogRaw.trim()}
        </pre>
      </Modal>

      <Modal title={translate(settings?.uiLanguage, 'whatsNew')} open={autoWhatsNewOpen} onClose={closeAutoWhatsNew}>
        <pre className="whitespace-pre-wrap rounded-md bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
          {parseCurrentChangelog(info?.version ?? '0.1.0')}
        </pre>
      </Modal>

      <Toasts toasts={toasts} />
    </div>
    </I18nProvider>
  );
}
