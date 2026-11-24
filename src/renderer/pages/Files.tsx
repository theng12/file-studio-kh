import { useEffect, useMemo, useState } from 'react';
import type { FileListQuery, FolderTreeItem, RecentRoot, ScannedFile, ScanProgress, ScanSummary, TagSummary } from '../../shared/types/app';
import { FileThumb } from '../components/FileThumb';
import { useI18n } from '../i18n';

interface FilesProps {
  activeRoot: RecentRoot | null;
  files: ScannedFile[];
  folders: FolderTreeItem[];
  scanTags: TagSummary[];
  selectedFileIds: string[];
  total: number;
  limit: number;
  offset: number;
  scanBusy: boolean;
  scanProgress: ScanProgress | null;
  summary: ScanSummary | null;
  onChooseFolder: () => Promise<void>;
  onCancelScan: () => Promise<void>;
  onLoadFiles: (query: FileListQuery) => Promise<void>;
  onOpenActions: () => void;
  onRescan: () => void;
  onSelectMatching: (query: FileListQuery) => Promise<void>;
  onSelectionChange: (fileIds: string[]) => void;
}

const PAGE_SIZES = [25, 50, 100, 200];
const VIEW_MODES = ['list', 'grid'] as const;
const DETAIL_WIDTHS = [
  { value: 'compact', labelKey: 'compact', width: 320 },
  { value: 'comfort', labelKey: 'comfort', width: 420 },
  { value: 'wide', labelKey: 'wide', width: 560 },
] as const;
type ViewMode = (typeof VIEW_MODES)[number];
type DetailWidth = (typeof DETAIL_WIDTHS)[number]['value'];
const REVIEW_STATUSES: Array<{ value: ScannedFile['status']; label: string }> = [
  { value: 'approved', label: 'Approved' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'reference', label: 'Reference' },
  { value: 'trash_candidate', label: 'Trash candidate' },
  { value: 'organized', label: 'Organized' },
];
const STATUS_LABELS: Record<string, string> = Object.fromEntries(REVIEW_STATUSES.map((s) => [s.value, s.label]));
const SCAN_STATUS_LABELS: Record<string, string> = {
  running: 'Scanning',
  completed: 'Scan complete',
  failed: 'Scan failed',
  cancelled: 'Scan cancelled',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function pageLabel(total: number, offset: number, limit: number): string {
  if (total === 0) return 'Showing 0 of 0';
  const start = offset + 1;
  const end = Math.min(offset + limit, total);
  return `Showing ${start.toLocaleString()}-${end.toLocaleString()} of ${total.toLocaleString()}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

export function Files({
  activeRoot,
  files,
  folders,
  scanTags,
  selectedFileIds,
  total,
  limit,
  offset,
  scanBusy,
  scanProgress,
  summary,
  onChooseFolder,
  onCancelScan,
  onLoadFiles,
  onOpenActions,
  onRescan,
  onSelectMatching,
  onSelectionChange,
}: FilesProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('/');
  const [fileType, setFileType] = useState<'all' | ScannedFile['fileType']>('all');
  const [extension, setExtension] = useState('all');
  const [tag, setTag] = useState('all');
  const [reviewStatus, setReviewStatus] = useState<'all' | ScannedFile['status']>('all');
  const [minSizeMb, setMinSizeMb] = useState('');
  const [maxSizeMb, setMaxSizeMb] = useState('');
  const [modifiedAfter, setModifiedAfter] = useState('');
  const [modifiedBefore, setModifiedBefore] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [detailFileId, setDetailFileId] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const stored = window.localStorage.getItem('file-studio-kh.files.viewMode');
    return stored === 'grid' ? 'grid' : 'list';
  });
  const [detailWidth, setDetailWidthState] = useState<DetailWidth>(() => {
    const stored = window.localStorage.getItem('file-studio-kh.files.detailWidth');
    return DETAIL_WIDTHS.some((item) => item.value === stored) ? stored as DetailWidth : 'comfort';
  });

  const extensions = useMemo(() => summary?.byExtension.map((item) => item.extension) ?? [], [summary]);
  const fileTypes = useMemo(() => summary?.byType.map((item) => item.fileType as ScannedFile['fileType']) ?? [], [summary]);
  const selectedSet = useMemo(() => new Set(selectedFileIds), [selectedFileIds]);
  const detailWidthPixels = DETAIL_WIDTHS.find((item) => item.value === detailWidth)?.width ?? 420;
  const detailFile = useMemo(
    () => files.find((file) => file.id === detailFileId) ?? files.find((file) => selectedSet.has(file.id)) ?? files[0] ?? null,
    [detailFileId, files, selectedSet],
  );
  useEffect(() => {
    if (!summary) return;
    const handle = window.setTimeout(() => {
      void onLoadFiles({
        batchId: summary.batchId,
        limit: pageSize,
        offset: 0,
        search,
        folder: selectedFolder,
        fileType,
        extension,
        tag,
        status: reviewStatus,
        minSizeBytes: megabytesToBytes(minSizeMb),
        maxSizeBytes: megabytesToBytes(maxSizeMb),
        modifiedAfter: modifiedAfter || undefined,
        modifiedBefore: modifiedBefore || undefined,
      });
    }, 180);

    return () => window.clearTimeout(handle);
  }, [summary, search, selectedFolder, fileType, extension, tag, reviewStatus, minSizeMb, maxSizeMb, modifiedAfter, modifiedBefore, pageSize, onLoadFiles]);

  function loadPage(nextOffset: number): void {
    const query = currentQuery(nextOffset);
    if (query) void onLoadFiles(query);
  }

  function currentQuery(nextOffset = offset): FileListQuery | null {
    if (!summary) return null;
    return {
      batchId: summary.batchId,
      limit: pageSize,
      offset: nextOffset,
      search,
      folder: selectedFolder,
      fileType,
      extension,
      tag,
      status: reviewStatus,
      minSizeBytes: megabytesToBytes(minSizeMb),
      maxSizeBytes: megabytesToBytes(maxSizeMb),
      modifiedAfter: modifiedAfter || undefined,
      modifiedBefore: modifiedBefore || undefined,
    };
  }

  const canPrevious = offset > 0;
  const canNext = offset + limit < total;
  const visibleIds = files.map((file) => file.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  const anyFilter = Boolean(search) || selectedFolder !== '/' || fileType !== 'all' || extension !== 'all'
    || tag !== 'all' || reviewStatus !== 'all' || minSizeMb !== '' || maxSizeMb !== '' || modifiedAfter !== '' || modifiedBefore !== '';
  const emptyMessage = !summary
    ? 'No folder scanned yet — choose a folder to begin.'
    : summary.status === 'failed' || summary.status === 'cancelled'
      ? (summary.errorMessage ?? 'The last scan did not finish — scan again.')
      : anyFilter
        ? 'No files match these filters — clear filters to see everything.'
        : 'No files found in this folder — rescan or choose another folder.';

  function setViewMode(next: ViewMode): void {
    setViewModeState(next);
    window.localStorage.setItem('file-studio-kh.files.viewMode', next);
  }

  function setDetailWidth(next: DetailWidth): void {
    setDetailWidthState(next);
    window.localStorage.setItem('file-studio-kh.files.detailWidth', next);
  }

  function toggleFile(fileId: string): void {
    if (selectedSet.has(fileId)) {
      onSelectionChange(selectedFileIds.filter((id) => id !== fileId));
    } else {
      onSelectionChange([...selectedFileIds, fileId]);
    }
  }

  function toggleVisible(): void {
    if (allVisibleSelected) {
      onSelectionChange(selectedFileIds.filter((id) => !visibleIds.includes(id)));
    } else {
      onSelectionChange(Array.from(new Set([...selectedFileIds, ...visibleIds])));
    }
  }

  async function revealSelectedFolder(): Promise<void> {
    if (!activeRoot) return;
    const folder = selectedFolder === '/' ? '' : selectedFolder;
    await window.api.folders.revealPath(activeRoot.rootPath, folder);
  }

  async function copyText(label: string, value: string): Promise<void> {
    await navigator.clipboard.writeText(value);
    setCopyStatus(`${label}: ${t('copied')}`);
    window.setTimeout(() => setCopyStatus(null), 1800);
  }

  async function revealDetailFile(): Promise<void> {
    if (!detailFile) return;
    await window.api.folders.revealItem(detailFile.rootPath, detailFile.relativePath);
  }

  async function openDetailFile(): Promise<void> {
    if (!detailFile) return;
    await window.api.folders.openItem(detailFile.rootPath, detailFile.relativePath);
  }

  async function updateStatus(status: ScannedFile['status'], fileIds = selectedFileIds): Promise<void> {
    if (!summary || fileIds.length === 0) return;
    await window.api.files.updateStatus(summary.batchId, fileIds, status);
    const query = currentQuery();
    if (query) await onLoadFiles(query);
  }

  function megabytesToBytes(value: string): number | undefined {
    const next = Number(value);
    if (!Number.isFinite(next) || next <= 0) return undefined;
    return Math.floor(next * 1024 * 1024);
  }

  return (
    <div
      className="grid h-full min-h-0 overflow-hidden rounded-lg border border-line bg-white dark:border-neutral-800 dark:bg-neutral-900"
      style={{ gridTemplateColumns: `280px minmax(0, 1fr) ${detailWidthPixels}px` }}
    >
      <aside className="flex min-h-0 flex-col border-r border-line p-4 dark:border-neutral-800">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">{t('folderTree')}</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-xs font-semibold text-accent hover:underline"
              onClick={() => setSelectedFolder('/')}
            >
              {t('all')}
            </button>
            <button
              type="button"
              className="text-xs font-semibold text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!activeRoot}
              onClick={() => void revealSelectedFolder()}
            >
              {selectedFolder === '/' ? t('revealRoot') : t('revealFolder')}
            </button>
          </div>
        </div>
        {folders.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed border-line p-4 text-sm text-neutral-500 dark:border-neutral-700">
            {t('selectAndScanFolder')}
          </div>
        ) : (
          <div className="mt-4 min-h-0 flex-1 space-y-1 overflow-auto pr-1">
            {folders.map((folder) => (
              <button
                key={folder.relativePath}
                type="button"
                className={`block w-full truncate rounded px-2 py-1.5 text-left text-sm ${
                  selectedFolder === folder.relativePath
                    ? 'bg-neutral-200 font-semibold text-neutral-950 dark:bg-neutral-800 dark:text-white'
                    : 'text-neutral-600 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
                style={{ paddingLeft: `${8 + folder.depth * 12}px` }}
                onClick={() => setSelectedFolder(folder.relativePath)}
                title={folder.relativePath}
              >
                <span>{folder.name}</span>
                <span className="ml-2 text-xs text-neutral-400">{folder.fileCount}</span>
              </button>
            ))}
          </div>
        )}
      </aside>

      <section className="flex min-h-0 min-w-0 flex-col">
        <div className="shrink-0 space-y-3 border-b border-line p-4 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <input
              className="h-9 min-w-0 flex-1 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-accent dark:border-neutral-700 dark:bg-neutral-950"
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button
              type="button"
              className="rounded-md border border-line px-3 py-2 text-sm font-medium dark:border-neutral-700"
              onClick={() => activeRoot ? onRescan() : void onChooseFolder()}
              disabled={scanBusy}
            >
              {activeRoot ? t('rescan') : t('chooseFolder')}
            </button>
            {scanBusy && (
              <button
                type="button"
                className="rounded-md border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 dark:border-rose-900 dark:text-rose-300"
                onClick={() => void onCancelScan()}
              >
                {t('cancel')}
              </button>
            )}
          </div>

          {scanBusy && scanProgress && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
              <div className="flex justify-between gap-3">
                <span className="truncate">{scanProgress.message}</span>
                <span className="shrink-0">{scanProgress.fileCount.toLocaleString()} {t('files')}</span>
              </div>
            </div>
          )}

          <div className="grid gap-2 md:grid-cols-6">
            <select
              className="h-9 rounded-md border border-line bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              aria-label="File type"
              value={fileType}
              onChange={(event) => setFileType(event.target.value as typeof fileType)}
            >
              <option value="all">{t('allTypes')}</option>
              {fileTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <select
              className="h-9 rounded-md border border-line bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              aria-label="Extension"
              value={extension}
              onChange={(event) => setExtension(event.target.value)}
            >
              <option value="all">{t('allExtensions')}</option>
              {extensions.map((ext) => <option key={ext} value={ext}>{ext}</option>)}
            </select>
            <select
              className="h-9 rounded-md border border-line bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              aria-label="Tag"
              value={tag}
              onChange={(event) => setTag(event.target.value)}
            >
              <option value="all">{t('allTags')}</option>
              {scanTags.map((item) => (
                <option key={item.tag} value={item.tag}>
                  {item.tag} ({item.count})
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-line bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              aria-label="Review status"
              value={reviewStatus}
              onChange={(event) => setReviewStatus(event.target.value as typeof reviewStatus)}
            >
              <option value="all">All statuses</option>
              {REVIEW_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
            <button
              type="button"
              className="rounded-md border border-line px-3 py-2 text-sm font-medium dark:border-neutral-700"
              onClick={() => {
                setSearch('');
                setSelectedFolder('/');
                setFileType('all');
                setExtension('all');
                setTag('all');
                setReviewStatus('all');
                setMinSizeMb('');
                setMaxSizeMb('');
                setModifiedAfter('');
                setModifiedBefore('');
                onSelectionChange([]);
              }}
            >
              {t('clearFilters')}
            </button>
            <div className="flex h-9 overflow-hidden rounded-md border border-line dark:border-neutral-700">
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`flex-1 px-3 text-sm font-semibold ${
                    viewMode === mode
                      ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-white'
                      : 'bg-white text-neutral-600 hover:bg-neutral-50 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-800'
                  }`}
                  onClick={() => setViewMode(mode)}
                >
                  {t(mode)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            <input
              className="h-9 rounded-md border border-line bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              type="number"
              min={0}
              step={0.1}
              placeholder="Min size MB"
              aria-label="Minimum size in MB"
              value={minSizeMb}
              onChange={(event) => setMinSizeMb(event.target.value)}
            />
            <input
              className="h-9 rounded-md border border-line bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              type="number"
              min={0}
              step={0.1}
              placeholder="Max size MB"
              aria-label="Maximum size in MB"
              value={maxSizeMb}
              onChange={(event) => setMaxSizeMb(event.target.value)}
            />
            <input
              className="h-9 rounded-md border border-line bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              type="date"
              aria-label="Modified after"
              value={modifiedAfter}
              onChange={(event) => setModifiedAfter(event.target.value)}
            />
            <input
              className="h-9 rounded-md border border-line bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              type="date"
              aria-label="Modified before"
              value={modifiedBefore}
              onChange={(event) => setModifiedBefore(event.target.value)}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-4">
          <div className="mb-3 flex shrink-0 items-center justify-between text-sm text-neutral-500">
            <span>{summary ? pageLabel(total, offset, limit) : t('noScanLoaded')}</span>
            {activeRoot && <span className="max-w-[55%] truncate" title={activeRoot.rootPath}>{activeRoot.rootPath}</span>}
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-md border border-line dark:border-neutral-800">
            {viewMode === 'list' ? (
              <table className="w-full table-fixed text-left text-sm">
                <thead className="sticky top-0 z-10 bg-neutral-50 text-xs uppercase tracking-[0.12em] text-neutral-500 dark:bg-neutral-950">
                  <tr>
                    <th className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label="Select visible files"
                        checked={allVisibleSelected}
                        onChange={toggleVisible}
                      />
                    </th>
                    <th className="w-16 px-3 py-3">{t('preview')}</th>
                    <th className="px-3 py-3">{t('filename')}</th>
                    <th className="w-24 px-3 py-3">{t('type')}</th>
                    <th className="w-24 px-3 py-3">Ext</th>
                    <th className="w-28 px-3 py-3">{t('dimensions')}</th>
                    <th className="w-24 px-3 py-3">Size</th>
                    <th className="w-32 px-3 py-3">Modified</th>
                    <th className="w-52 px-3 py-3">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {files.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-16 text-center text-neutral-500">
                        {emptyMessage}
                      </td>
                    </tr>
                  ) : files.map((file) => (
                    <tr
                      key={file.id}
                      className={`cursor-pointer border-t border-line hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-950 ${
                        detailFile?.id === file.id ? 'bg-neutral-50 dark:bg-neutral-950' : ''
                      }`}
                      onClick={() => setDetailFileId(file.id)}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${file.filename}`}
                          checked={selectedSet.has(file.id)}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => toggleFile(file.id)}
                        />
                      </td>
                      <td className="px-3 py-3"><FileThumb file={file} /></td>
                      <td className="min-w-0 px-3 py-3">
                        <div className="truncate font-medium" title={file.relativePath}>{file.filename}</div>
                        <div className="truncate text-xs text-neutral-500">{file.folderRelativePath || '/'}</div>
                      </td>
                      <td className="px-3 py-3 capitalize text-neutral-600 dark:text-neutral-300">{file.fileType}</td>
                      <td className="px-3 py-3 text-neutral-600 dark:text-neutral-300">{file.extension}</td>
                      <td className="px-3 py-3 text-neutral-600 dark:text-neutral-300">
                        {file.width && file.height ? `${file.width}x${file.height}` : '-'}
                      </td>
                      <td className="px-3 py-3 text-neutral-600 dark:text-neutral-300">{formatBytes(file.sizeBytes)}</td>
                      <td className="px-3 py-3 text-neutral-600 dark:text-neutral-300">{formatDate(file.modifiedAt)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {file.tags.length === 0 ? (
                            <span className="text-neutral-400">-</span>
                          ) : file.tags.slice(0, 3).map((item) => (
                            <span key={item} className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                              {item}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-3">
                {files.length === 0 ? (
                  <div className="px-3 py-16 text-center text-sm text-neutral-500">{emptyMessage}</div>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
                    {files.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        className={`min-w-0 rounded-md border p-3 text-left transition hover:border-accent hover:bg-neutral-50 dark:hover:bg-neutral-950 ${
                          detailFile?.id === file.id
                            ? 'border-accent bg-teal-50 dark:bg-teal-950/30'
                            : 'border-line dark:border-neutral-800'
                        }`}
                        onClick={() => setDetailFileId(file.id)}
                      >
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <input
                            type="checkbox"
                            aria-label={`Select ${file.filename}`}
                            checked={selectedSet.has(file.id)}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggleFile(file.id)}
                          />
                          <span className="truncate rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-semibold capitalize text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                            {file.fileType}
                          </span>
                        </div>
                        <div className="flex justify-center rounded bg-neutral-50 py-3 dark:bg-neutral-950">
                          <FileThumb file={file} size="lg" />
                        </div>
                        <div className="mt-3 min-w-0">
                          <div className="truncate text-sm font-semibold" title={file.relativePath}>{file.filename}</div>
                          <div className="mt-1 truncate text-xs text-neutral-500">{file.folderRelativePath || '/'}</div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                          <span>{formatBytes(file.sizeBytes)}</span>
                          <span className="truncate text-right">{file.width && file.height ? `${file.width}x${file.height}` : '-'}</span>
                          <span>{file.extension}</span>
                          <span className="truncate text-right">{formatDate(file.modifiedAt)}</span>
                        </div>
                        {file.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {file.tags.slice(0, 2).map((item) => (
                              <span key={item} className="max-w-full truncate rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                {item}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-3 flex shrink-0 items-center justify-between gap-3 text-sm">
            <div className="text-neutral-500">
              {summary
                ? `${pageLabel(total, offset, limit)} · ${selectedFileIds.length.toLocaleString()} ${t('selected')}`
                : 'No folder scanned yet — choose a folder to begin.'}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-line px-3 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700"
                disabled={!summary || total === 0}
                onClick={() => {
                  const query = currentQuery(0);
                  if (query) void onSelectMatching({ ...query, limit: total, offset: 0 });
                }}
              >
                {t('selectMatching')}
              </button>
              <select
                className="h-9 rounded-md border border-line bg-white px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950"
                value=""
                disabled={selectedFileIds.length === 0}
                onChange={(event) => {
                  const next = event.target.value as ScannedFile['status'];
                  if (next) void updateStatus(next);
                }}
              >
                <option value="">{t('setStatus')}</option>
                {REVIEW_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-md border border-line px-3 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700"
                disabled={selectedFileIds.length === 0}
                onClick={() => onSelectionChange([])}
              >
                {t('clearSelection')}
              </button>
              <button
                type="button"
                className="rounded-md bg-accent px-3 py-2 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={selectedFileIds.length === 0}
                onClick={onOpenActions}
              >
                {t('previewAction')}
              </button>
              <select
                className="h-9 rounded-md border border-line bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
              >
                {PAGE_SIZES.map((size) => <option key={size} value={size}>{size} / page</option>)}
              </select>
              <button
                type="button"
                className="rounded-md border border-line px-3 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700"
                disabled={!canPrevious}
                onClick={() => loadPage(Math.max(offset - limit, 0))}
              >
                Previous
              </button>
              <button
                type="button"
                className="rounded-md border border-line px-3 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700"
                disabled={!canNext}
                onClick={() => loadPage(offset + limit)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>

      <aside className="min-h-0 overflow-auto border-l border-line p-4 dark:border-neutral-800">
        <div className="flex items-start justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">{detailFile ? t('fileDetails') : t('preview')}</div>
          <select
            className="h-8 shrink-0 rounded-md border border-line bg-white px-2 text-xs font-semibold dark:border-neutral-700 dark:bg-neutral-950"
            aria-label={t('detailPanel')}
            value={detailWidth}
            onChange={(event) => setDetailWidth(event.target.value as DetailWidth)}
          >
            {DETAIL_WIDTHS.map((item) => (
              <option key={item.value} value={item.value}>{t(item.labelKey)}</option>
            ))}
          </select>
        </div>
        {!detailFile && <p className="mt-4 text-sm leading-6 text-neutral-500">{t('selectFilesForPreview')}</p>}
        {detailFile && (
          <div className="mt-4 space-y-4">
            <div className="rounded-md border border-line p-3 dark:border-neutral-800">
              <div className="mb-3 flex justify-center">
                <FileThumb file={detailFile} size={detailWidth === 'wide' ? 'xl' : 'lg'} />
              </div>
              <div className="break-words text-sm font-semibold">{detailFile.filename}</div>
              <div className="mt-1 break-words text-xs leading-5 text-neutral-500">{detailFile.relativePath}</div>
            </div>

            <div className="grid gap-2">
              <button
                type="button"
                className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                onClick={() => void revealDetailFile()}
              >
                {t('revealFile')}
              </button>
              <button
                type="button"
                className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                onClick={() => void openDetailFile()}
              >
                {t('openFile')}
              </button>
              <button
                type="button"
                className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                onClick={() => void copyText(t('copyFilename'), detailFile.filename)}
              >
                {t('copyFilename')}
              </button>
              <button
                type="button"
                className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                onClick={() => void copyText(t('copyRelativePath'), detailFile.relativePath)}
              >
                {t('copyRelativePath')}
              </button>
              <button
                type="button"
                className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                onClick={() => void copyText(t('copyFullPath'), `${detailFile.rootPath}/${detailFile.relativePath}`)}
              >
                {t('copyFullPath')}
              </button>
            </div>

            {copyStatus && (
              <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                {copyStatus}
              </div>
            )}

            <div className="space-y-3 rounded-md bg-neutral-50 p-3 text-sm dark:bg-neutral-950">
              <div className="flex justify-between gap-3"><span className="text-neutral-500">{t('type')}</span><span className="font-medium capitalize">{detailFile.fileType}</span></div>
              <div className="flex justify-between gap-3"><span className="text-neutral-500">Size</span><span className="font-medium">{formatBytes(detailFile.sizeBytes)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-neutral-500">{t('dimensions')}</span><span className="font-medium">{detailFile.width && detailFile.height ? `${detailFile.width}x${detailFile.height}` : '-'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-neutral-500">Extension</span><span className="font-medium">{detailFile.extension}</span></div>
              <div className="flex justify-between gap-3"><span className="text-neutral-500">Modified</span><span className="font-medium">{formatDate(detailFile.modifiedAt)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-neutral-500">Status</span><span className="font-medium">{STATUS_LABELS[detailFile.status] ?? detailFile.status}</span></div>
            </div>

            <div className="rounded-md border border-line p-3 dark:border-neutral-800">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400" htmlFor="detailStatus">{t('setStatus')}</label>
              <select
                id="detailStatus"
                className="mt-2 h-9 w-full rounded-md border border-line bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={detailFile.status}
                onChange={(event) => void updateStatus(event.target.value as ScannedFile['status'], [detailFile.id])}
              >
                {REVIEW_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        {summary && (
          <div className="mt-5 space-y-3 rounded-md bg-neutral-50 p-3 text-sm dark:bg-neutral-950">
            <div className="flex justify-between"><span className="text-neutral-500">Status</span><span className="font-medium">{SCAN_STATUS_LABELS[summary.status] ?? summary.status}</span></div>
            <div className="flex justify-between"><span className="text-neutral-500">{t('total')}</span><span className="font-medium">{summary.fileCount.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-neutral-500">Scan ID</span><span className="font-medium" title={summary.batchId}>{summary.batchId.slice(0, 8)}</span></div>
            {summary.status === 'failed' && summary.errorMessage && (
              <div className="rounded bg-rose-50 px-2 py-1 text-rose-700 dark:bg-rose-950 dark:text-rose-200">{summary.errorMessage}</div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
