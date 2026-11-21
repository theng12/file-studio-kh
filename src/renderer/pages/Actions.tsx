import { useEffect, useState } from 'react';
import type { RouteId } from '../App';
import type { ActionApplyResult, ActionPreviewOperation, ActionPreviewResult, RecentRoot, ScanSummary } from '../../shared/types/app';
import { useI18n } from '../i18n';
import { Modal } from '../components/Modal';

interface ActionsProps {
  activeRoot: RecentRoot | null;
  scanSummary: ScanSummary | null;
  selectedFileIds: string[];
  initialPreview: ActionPreviewResult | null;
  onNavigate: (route: RouteId) => void;
}

interface ActionPreset {
  id: string;
  name: string;
  operation: ActionPreviewOperation;
}

const PRESETS_KEY = 'fskh.actionPresets';

function statusClass(status: string): string {
  if (status === 'ready') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
  if (status === 'conflict') return 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200';
  if (status === 'invalid') return 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200';
  return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function Actions({ activeRoot, scanSummary, selectedFileIds, initialPreview, onNavigate }: ActionsProps) {
  const { t } = useI18n();
  const [operationType, setOperationType] = useState<ActionPreviewOperation['type']>('trash');
  const [targetFolder, setTargetFolder] = useState('_organized');
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [replaceFrom, setReplaceFrom] = useState('');
  const [replaceTo, setReplaceTo] = useState('');
  const [removeText, setRemoveText] = useState('');
  const [sequenceBaseName, setSequenceBaseName] = useState('file');
  const [sequenceStart, setSequenceStart] = useState(1);
  const [sequencePadding, setSequencePadding] = useState(3);
  const [sequenceSeparator, setSequenceSeparator] = useState('-');
  const [extensionCasing, setExtensionCasing] = useState<'lower' | 'upper'>('lower');
  const [preview, setPreview] = useState<ActionPreviewResult | null>(null);
  const [applyResult, setApplyResult] = useState<ActionApplyResult | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [applying, setApplying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presets, setPresets] = useState<ActionPreset[]>([]);
  const [presetDialog, setPresetDialog] = useState(false);
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    try {
      setPresets(JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '[]') as ActionPreset[]);
    } catch {
      setPresets([]);
    }
  }, []);

  useEffect(() => {
    if (!initialPreview) return;
    setPreview(initialPreview);
    setApplyResult(null);
    setConfirmApply(false);
    setOperationType(initialPreview.operationType);
  }, [initialPreview]);

  function operation(): ActionPreviewOperation {
    if (operationType === 'move') return { type: 'move', targetFolder };
    if (operationType === 'rename') {
      return {
        type: 'rename',
        prefix,
        suffix,
        replaceFrom,
        replaceTo,
        removeText,
      };
    }
    if (operationType === 'sequence') {
      return {
        type: 'sequence',
        baseName: sequenceBaseName,
        start: sequenceStart,
        padding: sequencePadding,
        separator: sequenceSeparator,
      };
    }
    if (operationType === 'normalizeExtension') return { type: 'normalizeExtension', casing: extensionCasing };
    if (operationType === 'isolateFormat') return { type: 'isolateFormat' };
    if (operationType === 'productFolders') return { type: 'productFolders' };
    if (operationType === 'suggestedRename') return { type: 'suggestedRename', suggestions: [] };
    return { type: 'trash' };
  }

  function savePresets(next: ActionPreset[]): void {
    setPresets(next);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
  }

  function loadPreset(preset: ActionPreset): void {
    setOperationType(preset.operation.type);
    setPreview(null);
    setApplyResult(null);
    if (preset.operation.type === 'move') setTargetFolder(preset.operation.targetFolder);
    if (preset.operation.type === 'rename') {
      setPrefix(preset.operation.prefix ?? '');
      setSuffix(preset.operation.suffix ?? '');
      setReplaceFrom(preset.operation.replaceFrom ?? '');
      setReplaceTo(preset.operation.replaceTo ?? '');
      setRemoveText(preset.operation.removeText ?? '');
    }
    if (preset.operation.type === 'sequence') {
      setSequenceBaseName(preset.operation.baseName);
      setSequenceStart(preset.operation.start);
      setSequencePadding(preset.operation.padding);
      setSequenceSeparator(preset.operation.separator);
    }
    if (preset.operation.type === 'normalizeExtension') setExtensionCasing(preset.operation.casing);
  }

  function saveCurrentPreset(): void {
    const name = presetName.trim();
    if (!name) return;
    savePresets([
      { id: crypto.randomUUID(), name, operation: operation() },
      ...presets.filter((item) => item.name !== name),
    ].slice(0, 24));
    setPresetDialog(false);
    setPresetName('');
  }

  async function buildPreview(): Promise<void> {
    if (!activeRoot || !scanSummary) {
      setError('Scan a folder before building an action preview.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await window.api.actions.preview({
        batchId: scanSummary.batchId,
        rootPath: activeRoot.rootPath,
        fileIds: selectedFileIds,
        operation: operation(),
      });
      setPreview(result);
      setApplyResult(null);
      setConfirmApply(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build preview');
    } finally {
      setBusy(false);
    }
  }

  async function applyPreview(): Promise<void> {
    if (!preview) return;
    setApplying(true);
    setError(null);
    try {
      const result = await window.api.actions.applyPreview(preview.previewId);
      setApplyResult(result);
      setConfirmApply(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply preview');
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-start justify-between gap-5">
          <div>
            <h2 className="text-base font-semibold">Preview bulk action</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Build a preview first, then apply only the ready rows after confirmation.
            </p>
          </div>
          <div className="rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-semibold dark:bg-neutral-800">
            {selectedFileIds.length.toLocaleString()} selected
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div>
            <label className="text-sm font-semibold" htmlFor="operationType">Operation</label>
            <select
              id="operationType"
              className="mt-2 h-9 w-full rounded-md border border-line bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              value={operationType}
              onChange={(event) => {
                setOperationType(event.target.value as ActionPreviewOperation['type']);
                setPreview(null);
              }}
            >
              <option value="trash">Move to _trash</option>
              <option value="move">Move to folder</option>
              <option value="rename">Rename transform</option>
              <option value="sequence">Sequential numbering</option>
              <option value="normalizeExtension">Normalize extension casing</option>
              <option value="isolateFormat">Isolate by format</option>
              <option value="productFolders">Product code folders</option>
            </select>
          </div>

          {operationType === 'move' && (
            <div>
              <label className="text-sm font-semibold" htmlFor="targetFolder">Target folder</label>
              <input
                id="targetFolder"
                className="mt-2 h-9 w-full rounded-md border border-line bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={targetFolder}
                onChange={(event) => setTargetFolder(event.target.value)}
                placeholder="_organized"
              />
            </div>
          )}

          {operationType === 'rename' && (
            <div className="grid gap-3 md:grid-cols-2">
              <input className="h-9 rounded-md border border-line bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" value={prefix} onChange={(event) => setPrefix(event.target.value)} placeholder="Prefix" />
              <input className="h-9 rounded-md border border-line bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" value={suffix} onChange={(event) => setSuffix(event.target.value)} placeholder="Suffix" />
              <input className="h-9 rounded-md border border-line bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" value={replaceFrom} onChange={(event) => setReplaceFrom(event.target.value)} placeholder="Replace text" />
              <input className="h-9 rounded-md border border-line bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" value={replaceTo} onChange={(event) => setReplaceTo(event.target.value)} placeholder="Replace with" />
              <input className="h-9 rounded-md border border-line bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950 md:col-span-2" value={removeText} onChange={(event) => setRemoveText(event.target.value)} placeholder="Remove text" />
            </div>
          )}

          {operationType === 'sequence' && (
            <div className="grid gap-3 md:grid-cols-4">
              <input
                className="h-9 rounded-md border border-line bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950 md:col-span-2"
                value={sequenceBaseName}
                onChange={(event) => setSequenceBaseName(event.target.value)}
                placeholder="Base filename"
              />
              <input
                className="h-9 rounded-md border border-line bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                type="number"
                min={0}
                value={sequenceStart}
                onChange={(event) => setSequenceStart(Number(event.target.value))}
                placeholder="Start"
              />
              <input
                className="h-9 rounded-md border border-line bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                type="number"
                min={1}
                max={8}
                value={sequencePadding}
                onChange={(event) => setSequencePadding(Number(event.target.value))}
                placeholder="Padding"
              />
              <input
                className="h-9 rounded-md border border-line bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={sequenceSeparator}
                onChange={(event) => setSequenceSeparator(event.target.value)}
                placeholder="Separator"
              />
            </div>
          )}

          {operationType === 'normalizeExtension' && (
            <div>
              <label className="text-sm font-semibold" htmlFor="extensionCasing">Extension casing</label>
              <select
                id="extensionCasing"
                className="mt-2 h-9 w-full rounded-md border border-line bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                value={extensionCasing}
                onChange={(event) => setExtensionCasing(event.target.value as 'lower' | 'upper')}
              >
                <option value="lower">Lowercase, like .jpg</option>
                <option value="upper">Uppercase, like .JPG</option>
              </select>
            </div>
          )}

          {operationType === 'isolateFormat' && (
            <div className="rounded-md border border-line bg-neutral-50 px-3 py-2 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
              Selected files will be previewed into `_pdf`, `_png`, `_raw`, or `_other` folders while preserving their filenames.
            </div>
          )}

          {operationType === 'productFolders' && (
            <div className="rounded-md border border-line bg-neutral-50 px-3 py-2 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
              Selected files will be previewed into folders named from detected product codes in their filenames.
            </div>
          )}
        </div>

        {error && <div className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">{error}</div>}

        <div className="mt-5 rounded-md border border-line bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Action presets</div>
              <div className="mt-1 text-sm text-neutral-500">Save and reuse common move, trash, rename, or sequence setups.</div>
            </div>
            <button
              type="button"
              className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-white dark:border-neutral-700 dark:hover:bg-neutral-900"
              onClick={() => {
                setPresetName(() => {
                  const existing = presets.find((item) => item.operation.type === operationType);
                  return existing ? existing.name : '';
                });
                setPresetDialog(true);
              }}
            >
              Save preset
            </button>
          </div>
          {presets.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {presets.map((preset) => (
                <div key={preset.id} className="flex items-center overflow-hidden rounded-md border border-line bg-white dark:border-neutral-800 dark:bg-neutral-900">
                  <button
                    type="button"
                    className="px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    onClick={() => loadPreset(preset)}
                  >
                    {preset.name}
                  </button>
                  <button
                    type="button"
                    className="border-l border-line px-2 py-1.5 text-sm text-neutral-500 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
                    onClick={() => savePresets(presets.filter((item) => item.id !== preset.id))}
                    title="Delete preset"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedFileIds.length === 0 && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-600 dark:bg-neutral-950 dark:text-neutral-300">
            <span>Select files on the Files page before building a preview.</span>
            <button
              type="button"
              className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold hover:bg-white dark:border-neutral-700 dark:hover:bg-neutral-900"
              onClick={() => onNavigate('files')}
            >
              Go to Files
            </button>
          </div>
        )}

        <button
          type="button"
          className="mt-5 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy || selectedFileIds.length === 0}
          onClick={() => void buildPreview()}
        >
          {busy ? 'Building preview...' : 'Build preview'}
        </button>
      </section>

      {preview && (
        <section className="rounded-lg border border-line bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="grid gap-3 md:grid-cols-6">
            {[
              ['Items', preview.itemCount],
              ['Ready', preview.readyCount],
              ['Conflicts', preview.conflictCount],
              ['Invalid', preview.invalidCount],
              ['Skipped', preview.skippedCount],
              ['Affected size', formatBytes(preview.affectedBytes)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md bg-neutral-50 p-3 dark:bg-neutral-950">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">{label}</div>
                <div className="mt-1 text-xl font-semibold">{value}</div>
              </div>
            ))}
          </div>

          {preview.foldersToCreate.length > 0 && (
            <div className="mt-5 rounded-md border border-dashed border-line bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-950">
              <div className="text-sm font-semibold">Folders required by this preview</div>
              <p className="mt-1 text-sm text-neutral-500">These are not created yet. They are shown so you can inspect the dry run.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {preview.foldersToCreate.map((folder) => (
                  <span key={folder} className="rounded bg-white px-2 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
                    {folder}
                  </span>
                ))}
              </div>
            </div>
          )}

          {preview.readyCount > 0 && !applyResult && (
            <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
              <div className="text-sm font-semibold text-amber-950 dark:text-amber-100">Apply this preview</div>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                This will move or rename {preview.readyCount.toLocaleString()} ready file{preview.readyCount === 1 ? '' : 's'} on disk, affecting {formatBytes(preview.affectedBytes)}. Conflict, invalid, and skipped rows will not be touched.
              </p>
              <div className="mt-3 grid gap-2 text-sm text-amber-900 dark:text-amber-100 md:grid-cols-3">
                <div className="rounded-md bg-white/70 px-3 py-2 dark:bg-amber-900/40">
                  <div className="font-semibold">Folders</div>
                  <div>{preview.foldersToCreate.length.toLocaleString()} required</div>
                </div>
                <div className="rounded-md bg-white/70 px-3 py-2 dark:bg-amber-900/40">
                  <div className="font-semibold">Operation</div>
                  <div className="capitalize">{preview.operationType}</div>
                </div>
                <div className="rounded-md bg-white/70 px-3 py-2 dark:bg-amber-900/40">
                  <div className="font-semibold">Undo</div>
                  <div>Logged in History</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-medium text-amber-950 dark:text-amber-100">
                  <input
                    type="checkbox"
                    checked={confirmApply}
                    onChange={(event) => setConfirmApply(event.target.checked)}
                  />
                  I understand this will modify files on disk
                </label>
                <button
                  type="button"
                  className="rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!confirmApply || applying}
                  onClick={() => void applyPreview()}
                >
                  {applying ? 'Applying...' : t('applyReadyChanges')}
                </button>
              </div>
            </div>
          )}

          {applyResult && (
            <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
              <div className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">Apply finished</div>
              <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
                Applied {applyResult.appliedCount.toLocaleString()}, failed {applyResult.failedCount.toLocaleString()}, skipped {applyResult.skippedCount.toLocaleString()}. Rescan the folder to refresh the Files view.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-md border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-950 hover:bg-white dark:border-emerald-800 dark:text-emerald-100 dark:hover:bg-emerald-900"
                  onClick={() => onNavigate('history')}
                >
                  View in History
                </button>
                <button
                  type="button"
                  className="rounded-md border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-950 hover:bg-white dark:border-emerald-800 dark:text-emerald-100 dark:hover:bg-emerald-900"
                  onClick={() => onNavigate('files')}
                >
                  Back to Files
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 overflow-hidden rounded-md border border-line dark:border-neutral-800">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-[0.12em] text-neutral-500 dark:bg-neutral-950">
                <tr>
                  <th className="w-28 px-3 py-3">Status</th>
                  <th className="px-3 py-3">Original path</th>
                  <th className="px-3 py-3">Proposed path</th>
                  <th className="w-64 px-3 py-3">Message</th>
                </tr>
              </thead>
              <tbody>
                {preview.items.map((item) => (
                  <tr key={item.fileId} className="border-t border-line dark:border-neutral-800">
                    <td className="px-3 py-3">
                      <span className={`rounded px-2 py-1 text-xs font-semibold ${statusClass(item.status)}`}>{item.status}</span>
                    </td>
                    <td className="truncate px-3 py-3" title={item.originalRelativePath}>{item.originalRelativePath || '-'}</td>
                    <td className="truncate px-3 py-3" title={item.proposedRelativePath ?? ''}>{item.proposedRelativePath ?? '-'}</td>
                    <td className="truncate px-3 py-3 text-neutral-500" title={item.message ?? ''}>{item.message ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Modal title="Save action preset" open={presetDialog} onClose={() => setPresetDialog(false)}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            saveCurrentPreset();
          }}
        >
          <label className="text-sm font-semibold" htmlFor="presetName">Name this preset</label>
          <p className="mt-1 text-sm text-neutral-500">It saves the current operation and its settings, not the selected files.</p>
          <input
            id="presetName"
            autoFocus
            className="mt-2 h-9 w-full rounded-md border border-line bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950"
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
            placeholder="Example: Product shots to trash"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-line px-3 py-2 text-sm font-semibold dark:border-neutral-700"
              onClick={() => setPresetDialog(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={!presetName.trim()}
            >
              Save preset
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
