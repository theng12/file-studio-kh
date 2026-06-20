import { useEffect, useMemo, useState } from 'react';
import type { ActionPreviewResult, DuplicateGroup, FilenameSuggestion, NearDuplicateGroup, ProductCodeGroup, RecentRoot, ScanSummary, ScannedFile } from '../../shared/types/app';
import { FileThumb } from '../components/FileThumb';

interface AdvancedProps {
  activeRoot: RecentRoot | null;
  scanSummary: ScanSummary | null;
  selectedFileIds: string[];
  onSelectionChange: (fileIds: string[]) => void;
  onPreviewReady: (preview: ActionPreviewResult) => void;
  onNavigateActions: () => void;
  onToast: (variant: 'info' | 'success' | 'error', message: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function MiniFile({ file, selected }: { file: ScannedFile; selected?: boolean }) {
  return (
    <div className={`min-w-0 rounded-md border p-2 ${selected ? 'border-accent bg-teal-50 dark:bg-teal-950/30' : 'border-line dark:border-neutral-800'}`}>
      <div className="flex items-center gap-2">
        <FileThumb file={file} size="lg" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold" title={file.relativePath}>{file.filename}</div>
          <div className="truncate text-xs text-neutral-500">{file.folderRelativePath || '/'}</div>
          <div className="mt-1 text-xs text-neutral-500">{formatBytes(file.sizeBytes)}</div>
        </div>
      </div>
    </div>
  );
}

export function Advanced({ activeRoot, scanSummary, selectedFileIds, onSelectionChange, onPreviewReady, onNavigateActions, onToast }: AdvancedProps) {
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [nearDuplicates, setNearDuplicates] = useState<NearDuplicateGroup[]>([]);
  const [suggestions, setSuggestions] = useState<FilenameSuggestion[]>([]);
  const [productGroups, setProductGroups] = useState<ProductCodeGroup[]>([]);
  const [selectedNearId, setSelectedNearId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ActionPreviewResult | null>(null);
  const selectedSet = useMemo(() => new Set(selectedFileIds), [selectedFileIds]);

  const selectedNear = useMemo(
    () => nearDuplicates.find((group) => group.id === selectedNearId) ?? nearDuplicates[0] ?? null,
    [nearDuplicates, selectedNearId],
  );

  useEffect(() => {
    if (!scanSummary) return;
    setBusy(true);
    Promise.all([
      window.api.advanced.duplicateGroups(scanSummary.batchId),
      window.api.advanced.nearDuplicateGroups(scanSummary.batchId, 8),
      window.api.advanced.filenameSuggestions(scanSummary.batchId),
      window.api.advanced.productCodeGroups(scanSummary.batchId),
    ]).then(([nextDuplicates, nextNear, nextSuggestions, nextCodes]) => {
      setDuplicates(nextDuplicates);
      setNearDuplicates(nextNear);
      setSuggestions(nextSuggestions);
      setProductGroups(nextCodes);
      setSelectedNearId(nextNear[0]?.id ?? null);
    }).catch((error) => {
      onToast('error', error instanceof Error ? error.message : 'Advanced analysis failed');
    }).finally(() => setBusy(false));
  }, [scanSummary, onToast]);

  async function exportScan(): Promise<void> {
    if (!scanSummary) return;
    const path = await window.api.advanced.exportScanCsv(scanSummary.batchId);
    if (path) onToast('success', `Exported scan CSV: ${path}`);
  }

  async function exportOperations(): Promise<void> {
    const path = await window.api.advanced.exportOperationsCsv();
    if (path) onToast('success', `Exported operation CSV: ${path}`);
  }

  async function previewProductFolders(fileIds: string[]): Promise<void> {
    if (!activeRoot || !scanSummary || fileIds.length === 0) return;
    const result = await window.api.actions.preview({
      batchId: scanSummary.batchId,
      rootPath: activeRoot.rootPath,
      fileIds,
      operation: { type: 'productFolders' },
    });
    setPreview(result);
    onPreviewReady(result);
    onSelectionChange(fileIds);
    onToast('success', `Built product-folder preview for ${result.itemCount.toLocaleString()} files`);
  }

  async function previewFilenameSuggestions(): Promise<void> {
    if (!activeRoot || !scanSummary || suggestions.length === 0) return;
    const result = await window.api.actions.preview({
      batchId: scanSummary.batchId,
      rootPath: activeRoot.rootPath,
      fileIds: suggestions.map((item) => item.fileId),
      operation: {
        type: 'suggestedRename',
        suggestions: suggestions.map((item) => ({ fileId: item.fileId, suggestedName: item.suggestedName })),
      },
    });
    setPreview(result);
    onPreviewReady(result);
    onSelectionChange(suggestions.map((item) => item.fileId));
    onToast('success', `Built filename cleanup preview for ${result.itemCount.toLocaleString()} files`);
  }

  async function previewTrashDuplicates(group: DuplicateGroup, keepFileId: string): Promise<void> {
    if (!activeRoot || !scanSummary) return;
    const trashIds = group.files.filter((file) => file.id !== keepFileId).map((file) => file.id);
    if (trashIds.length === 0) {
      onToast('info', 'Nothing to move. This group only has the kept file selected.');
      return;
    }

    const result = await window.api.actions.preview({
      batchId: scanSummary.batchId,
      rootPath: activeRoot.rootPath,
      fileIds: trashIds,
      operation: { type: 'trash' },
    });
    setPreview(result);
    onPreviewReady(result);
    onSelectionChange(trashIds);
    onToast('success', `Built duplicate cleanup preview for ${result.readyCount.toLocaleString()} files`);
  }

  function selectFiles(files: ScannedFile[]): void {
    onSelectionChange(files.map((file) => file.id));
    onToast('info', `Selected ${files.length.toLocaleString()} files`);
  }

  if (!scanSummary) {
    return (
      <section className="rounded-lg border border-line bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-base font-semibold">Advanced tools</h2>
        <p className="mt-2 text-sm text-neutral-500">Choose and scan a folder first.</p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Advanced workflow tools</h2>
            <p className="mt-1 text-sm text-neutral-500">Preview-first helpers for duplicates, filename cleanup, product codes, exports, and visual comparison.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800" onClick={() => void exportScan()}>
              Export scan CSV
            </button>
            <button type="button" className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800" onClick={() => void exportOperations()}>
              Export operation history
            </button>
          </div>
        </div>
        {busy && <div className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">Loading advanced analysis from the latest scan...</div>}
        {!busy && duplicates.length === 0 && nearDuplicates.length === 0 && (
          <div className="mt-4 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-500 dark:bg-neutral-950">
            Duplicate and similarity tools need a fresh 0.5.0+ rescan so hashes exist.
          </div>
        )}
        {selectedFileIds.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-950 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-100">
            <span>{selectedFileIds.length.toLocaleString()} files selected from Advanced.</span>
            <div className="flex items-center gap-2">
              <button type="button" className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800" onClick={onNavigateActions}>
                Open Actions
              </button>
              <button type="button" className="rounded-md border border-teal-200 px-3 py-1.5 text-sm font-semibold hover:bg-white dark:border-teal-800 dark:hover:bg-teal-900" onClick={() => onSelectionChange([])}>
                Clear
              </button>
            </div>
          </div>
        )}
        {preview && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            <span>Preview ready: {preview.readyCount.toLocaleString()} ready, {(preview.conflictCount + preview.invalidCount + preview.skippedCount).toLocaleString()} issues.</span>
            <button type="button" className="font-semibold underline" onClick={onNavigateActions}>Open Actions</button>
          </div>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-lg border border-line bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="text-sm font-semibold">Hash-based duplicate detection</h3>
          <p className="mt-1 text-sm text-neutral-500">Exact file-content matches. Pick a file to keep, then build a trash preview for the remaining duplicates.</p>
          <div className="mt-4 space-y-3">
            {duplicates.length === 0 ? (
              <div className="rounded-md border border-dashed border-line p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">No exact duplicate groups found.</div>
            ) : duplicates.slice(0, 8).map((group) => (
              <div key={group.key} className="rounded-md border border-line p-3 dark:border-neutral-800">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">{group.files.length} matching files · {formatBytes(group.totalBytes)}</div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800" onClick={() => selectFiles(group.files)}>
                      Select group
                    </button>
                    <button type="button" className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800" onClick={() => void previewTrashDuplicates(group, group.files[0].id)}>
                      Keep first, trash rest
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {group.files.slice(0, 4).map((file, index) => (
                    <div key={file.id} className="space-y-2">
                      <MiniFile file={file} selected={selectedSet.has(file.id)} />
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedSet.has(file.id) && <span className="rounded bg-teal-100 px-2 py-1 text-xs font-semibold text-teal-900 dark:bg-teal-900 dark:text-teal-100">Selected</span>}
                        {index === 0 && <span className="rounded bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">Default keep</span>}
                        <button type="button" className="rounded-md border border-line px-2 py-1 text-xs font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800" onClick={() => void previewTrashDuplicates(group, file.id)}>
                          Keep this, trash others
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="text-sm font-semibold">Side-by-side near-duplicate comparison</h3>
          <p className="mt-1 text-sm text-neutral-500">Image similarity by perceptual hash. Always inspect manually before applying actions.</p>
          <div className="mt-4 grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)]">
            <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
              {nearDuplicates.length === 0 ? (
                <div className="rounded-md border border-dashed border-line p-4 text-sm text-neutral-500 dark:border-neutral-700">No near groups found.</div>
              ) : nearDuplicates.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className={`block w-full rounded-md border px-3 py-2 text-left text-sm ${selectedNear?.id === group.id ? 'border-accent bg-teal-50 dark:bg-teal-950/30' : 'border-line dark:border-neutral-800'}`}
                  onClick={() => setSelectedNearId(group.id)}
                >
                  {group.files.length} images · distance {group.distance}
                </button>
              ))}
            </div>
            <div className="min-w-0">
              {selectedNear && (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    {selectedNear.files.slice(0, 4).map((file) => <MiniFile key={file.id} file={file} selected={selectedSet.has(file.id)} />)}
                  </div>
                  <button type="button" className="mt-3 rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800" onClick={() => selectFiles(selectedNear.files)}>
                    Select comparison files
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-lg border border-line bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="text-sm font-semibold">AI-ish filename cleanup suggestions</h3>
          <p className="mt-1 text-sm text-neutral-500">Heuristic, preview-only suggestions. They do not rename anything automatically.</p>
          {suggestions.length > 0 && (
            <button type="button" className="mt-3 rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800" onClick={() => void previewFilenameSuggestions()}>
              Build rename preview
            </button>
          )}
          <div className="mt-4 max-h-[360px] overflow-auto rounded-md border border-line dark:border-neutral-800">
            {suggestions.length === 0 ? (
              <div className="p-6 text-center text-sm text-neutral-500">No cleanup suggestions found.</div>
            ) : suggestions.map((item) => (
              <div key={item.fileId} className="border-b border-line px-3 py-2 text-sm last:border-b-0 dark:border-neutral-800">
                <div className="truncate font-semibold" title={item.relativePath}>{item.currentName}</div>
                <div className="truncate text-neutral-500" title={item.suggestedName}>{item.suggestedName}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="text-sm font-semibold">Product code extraction + batch folders</h3>
          <p className="mt-1 text-sm text-neutral-500">Groups filenames by detected product code and can create a safe move preview into those folders.</p>
          <div className="mt-4 max-h-[360px] space-y-2 overflow-auto pr-1">
            {productGroups.length === 0 ? (
              <div className="rounded-md border border-dashed border-line p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">No product codes found.</div>
            ) : productGroups.slice(0, 24).map((group) => (
              <div key={group.code} className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 dark:border-neutral-800">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{group.code}</div>
                  <div className="text-xs text-neutral-500">{group.count.toLocaleString()} files</div>
                </div>
                <button type="button" className="shrink-0 rounded-md border border-line px-3 py-1.5 text-sm font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800" onClick={() => void previewProductFolders(group.files.map((file) => file.id))}>
                  Preview folders
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="text-sm font-semibold">Current selection handoff</h3>
        <p className="mt-1 text-sm text-neutral-500">{selectedFileIds.length.toLocaleString()} files selected for Actions. Advanced tools select files but still use the normal preview/apply confirmation flow.</p>
      </section>
    </div>
  );
}
