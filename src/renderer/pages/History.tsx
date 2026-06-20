import { useEffect, useState } from 'react';
import type { ActionOperationDetail, ActionOperationHistoryItem, ActionPreviewHistoryItem, ActionPreviewItem, ActionPreviewResult, ActionUndoResult } from '../../shared/types/app';
import { useI18n } from '../i18n';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusClass(status: ActionPreviewItem['status']): string {
  if (status === 'ready') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
  if (status === 'conflict') return 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200';
  if (status === 'invalid') return 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200';
  return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200';
}

export function History() {
  const { t } = useI18n();
  const [previews, setPreviews] = useState<ActionPreviewHistoryItem[]>([]);
  const [operations, setOperations] = useState<ActionOperationHistoryItem[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<ActionOperationDetail | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<ActionPreviewResult | null>(null);
  const [revalidating, setRevalidating] = useState(false);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [undoResult, setUndoResult] = useState<ActionUndoResult | null>(null);

  useEffect(() => {
    void window.api.actions.listPreviews(50).then(setPreviews);
    void window.api.actions.listOperations(50).then(setOperations);
  }, []);

  async function openPreview(previewId: string): Promise<void> {
    const preview = await window.api.actions.getPreview(previewId);
    setSelectedPreview(preview);
  }

  async function openOperation(operationId: string): Promise<void> {
    const operation = await window.api.actions.getOperation(operationId);
    setSelectedOperation(operation);
  }

  async function revalidateSelected(): Promise<void> {
    if (!selectedPreview) return;
    setRevalidating(true);
    try {
      const next = await window.api.actions.revalidatePreview(selectedPreview.previewId);
      setSelectedPreview(next);
      const history = await window.api.actions.listPreviews(50);
      setPreviews(history);
    } finally {
      setRevalidating(false);
    }
  }

  async function undoOperation(operationId: string): Promise<void> {
    setUndoingId(operationId);
    setUndoResult(null);
    try {
      const result = await window.api.actions.undoOperation(operationId);
      setUndoResult(result);
      const next = await window.api.actions.listOperations(50);
      setOperations(next);
      const detail = selectedOperation?.id === operationId
        ? await window.api.actions.getOperation(operationId)
        : null;
      if (detail) setSelectedOperation(detail);
    } finally {
      setUndoingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-base font-semibold">{t('appliedOperations')}</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Undo restores files from their moved location when the target file still exists and the original path is free.
        </p>

        {operations.length === 0 ? (
          <div className="mt-5 rounded-md border border-dashed border-line p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
            {t('noAppliedOperationsYet')}
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-md border border-line dark:border-neutral-800">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-[0.12em] text-neutral-500 dark:bg-neutral-950">
                <tr>
                  <th className="w-44 px-3 py-3">Applied</th>
                  <th className="w-32 px-3 py-3">Operation</th>
                  <th className="px-3 py-3">Root</th>
                  <th className="w-28 px-3 py-3">Applied</th>
                  <th className="w-28 px-3 py-3">Issues</th>
                  <th className="w-28 px-3 py-3">Undo</th>
                  <th className="w-28 px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {operations.map((operation) => (
                  <tr
                    key={operation.id}
                    className={`cursor-pointer border-t border-line hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-950 ${
                      selectedOperation?.id === operation.id ? 'bg-neutral-50 dark:bg-neutral-950' : ''
                    }`}
                    onClick={() => void openOperation(operation.id)}
                  >
                    <td className="px-3 py-3">{formatDate(operation.createdAt)}</td>
                    <td className="px-3 py-3 capitalize">{operation.operationType}</td>
                    <td className="truncate px-3 py-3 text-neutral-500" title={operation.rootPath}>{operation.rootPath}</td>
                    <td className="px-3 py-3 text-emerald-700 dark:text-emerald-300">{operation.appliedCount.toLocaleString()}</td>
                    <td className="px-3 py-3 text-amber-700 dark:text-amber-300">{(operation.failedCount + operation.skippedCount).toLocaleString()}</td>
                    <td className="px-3 py-3 capitalize">{operation.undoStatus.replace('_', ' ')}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        className="rounded-md border border-line px-3 py-1.5 text-sm font-semibold hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
                        disabled={operation.appliedCount === 0 || operation.undoStatus === 'undone' || undoingId === operation.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          void undoOperation(operation.id);
                        }}
                      >
                        {undoingId === operation.id ? 'Undoing...' : 'Undo'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {undoResult && (
          <div className="mt-5 rounded-md border border-line bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-950">
            <div className="font-semibold">Undo result</div>
            <p className="mt-1 text-neutral-600 dark:text-neutral-300">
              Restored {undoResult.undoneCount.toLocaleString()}, failed {undoResult.failedCount.toLocaleString()}, skipped {undoResult.skippedCount.toLocaleString()}.
            </p>
            {undoResult.items.some((item) => item.status === 'failed') && (
              <div className="mt-3 max-h-40 overflow-auto rounded border border-line bg-white dark:border-neutral-800 dark:bg-neutral-900">
                {undoResult.items.filter((item) => item.status === 'failed').map((item) => (
                  <div key={`${item.fileId}-${item.targetPath}`} className="border-b border-line px-3 py-2 last:border-b-0 dark:border-neutral-800">
                    <div className="truncate font-medium" title={item.targetPath}>{item.targetPath}</div>
                    <div className="truncate text-neutral-500" title={item.message ?? ''}>{item.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {selectedOperation && (
        <section className="rounded-lg border border-line bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Operation detail</h2>
              <p className="mt-1 truncate text-sm text-neutral-500">{selectedOperation.rootPath}</p>
            </div>
            <div className="rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-semibold capitalize dark:bg-neutral-800">
              {selectedOperation.operationType}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {[
              ['Applied', selectedOperation.appliedCount],
              ['Failed', selectedOperation.failedCount],
              ['Skipped', selectedOperation.skippedCount],
              ['Undo', selectedOperation.undoStatus.replace('_', ' ')],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md bg-neutral-50 p-3 dark:bg-neutral-950">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">{label}</div>
                <div className="mt-1 text-xl font-semibold">{value}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 overflow-hidden rounded-md border border-line dark:border-neutral-800">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-[0.12em] text-neutral-500 dark:bg-neutral-950">
                <tr>
                  <th className="w-28 px-3 py-3">Status</th>
                  <th className="px-3 py-3">Original path</th>
                  <th className="px-3 py-3">Target path</th>
                  <th className="w-32 px-3 py-3">Undo</th>
                  <th className="w-64 px-3 py-3">Message</th>
                </tr>
              </thead>
              <tbody>
                {selectedOperation.items.map((item) => (
                  <tr key={`${selectedOperation.id}-${item.fileId}-${item.originalPath}`} className="border-t border-line dark:border-neutral-800">
                    <td className="px-3 py-3 capitalize">{item.status}</td>
                    <td className="truncate px-3 py-3" title={item.originalPath}>{item.originalPath}</td>
                    <td className="truncate px-3 py-3" title={item.targetPath ?? ''}>{item.targetPath ?? '-'}</td>
                    <td className="truncate px-3 py-3 capitalize" title={item.undoMessage ?? ''}>{item.undoStatus.replace('_', ' ')}</td>
                    <td className="truncate px-3 py-3 text-neutral-500" title={item.message ?? item.undoMessage ?? ''}>{item.message ?? item.undoMessage ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-line bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-base font-semibold">{t('previewHistory')}</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Preview records remain available for inspection and revalidation.
        </p>

        {previews.length === 0 ? (
          <div className="mt-5 rounded-md border border-dashed border-line p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
            {t('noPreviewYet')}
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-md border border-line dark:border-neutral-800">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-[0.12em] text-neutral-500 dark:bg-neutral-950">
                <tr>
                  <th className="w-44 px-3 py-3">Created</th>
                  <th className="w-32 px-3 py-3">Operation</th>
                  <th className="px-3 py-3">Root</th>
                  <th className="w-24 px-3 py-3">Items</th>
                  <th className="w-32 px-3 py-3">Ready</th>
                  <th className="w-32 px-3 py-3">Issues</th>
                </tr>
              </thead>
              <tbody>
                {previews.map((preview) => (
                  <tr
                    key={preview.id}
                    className={`cursor-pointer border-t border-line hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-950 ${
                      selectedPreview?.previewId === preview.id ? 'bg-neutral-50 dark:bg-neutral-950' : ''
                    }`}
                    onClick={() => void openPreview(preview.id)}
                  >
                    <td className="px-3 py-3">{formatDate(preview.createdAt)}</td>
                    <td className="px-3 py-3 capitalize">{preview.operationType}</td>
                    <td className="truncate px-3 py-3 text-neutral-500" title={preview.rootPath}>{preview.rootPath}</td>
                    <td className="px-3 py-3">{preview.itemCount.toLocaleString()}</td>
                    <td className="px-3 py-3 text-emerald-700 dark:text-emerald-300">{preview.readyCount.toLocaleString()}</td>
                    <td className="px-3 py-3 text-amber-700 dark:text-amber-300">
                      {(preview.conflictCount + preview.invalidCount + preview.skippedCount).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedPreview && (
        <section className="rounded-lg border border-line bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Preview detail</h2>
              <p className="mt-1 truncate text-sm text-neutral-500">{selectedPreview.rootPath}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
                disabled={revalidating}
                onClick={() => void revalidateSelected()}
              >
                {revalidating ? 'Revalidating...' : 'Revalidate'}
              </button>
              <div className="rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-semibold capitalize dark:bg-neutral-800">
                {selectedPreview.operationType}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-5">
            {[
              ['Items', selectedPreview.itemCount],
              ['Ready', selectedPreview.readyCount],
              ['Conflicts', selectedPreview.conflictCount],
              ['Invalid', selectedPreview.invalidCount],
              ['Skipped', selectedPreview.skippedCount],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md bg-neutral-50 p-3 dark:bg-neutral-950">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-400">{label}</div>
                <div className="mt-1 text-xl font-semibold">{value}</div>
              </div>
            ))}
          </div>

          {selectedPreview.foldersToCreate.length > 0 && (
            <div className="mt-5 rounded-md border border-dashed border-line bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-950">
              <div className="text-sm font-semibold">Folders required by this preview</div>
              <p className="mt-1 text-sm text-neutral-500">These were not created. This is preserved dry-run information.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedPreview.foldersToCreate.map((folder) => (
                  <span key={folder} className="rounded bg-white px-2 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
                    {folder}
                  </span>
                ))}
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
                {selectedPreview.items.map((item) => (
                  <tr key={`${selectedPreview.previewId}-${item.fileId}-${item.originalRelativePath}`} className="border-t border-line dark:border-neutral-800">
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
    </div>
  );
}
