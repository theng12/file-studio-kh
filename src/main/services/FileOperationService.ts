import { existsSync } from 'node:fs';
import { appendFile, mkdir, rename } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, normalize, relative } from 'node:path';
import { DatabaseService } from './DatabaseService';
import { SettingsService } from './SettingsService';
import type {
  ActionApplyItem,
  ActionApplyResult,
  ActionOperationDetail,
  ActionOperationHistoryItem,
  ActionPreviewItem,
  ActionPreviewResult,
  ActionUndoItem,
  ActionUndoResult,
} from '../../shared/types/app';

interface PreviewRow {
  id: string;
  created_at: string;
  root_path: string;
  operation_type: ActionPreviewResult['operationType'];
}

interface PreviewItemRow {
  file_id: string;
  original_relative_path: string;
  proposed_relative_path: string | null;
  status: ActionPreviewItem['status'];
  message: string | null;
}

interface OperationRow {
  id: string;
  preview_id: string;
  created_at: string;
  root_path: string;
  operation_type: ActionPreviewResult['operationType'];
  applied_count: number;
  failed_count: number;
  skipped_count: number;
  undo_status: ActionOperationHistoryItem['undoStatus'];
}

interface OperationItemRow {
  file_id: string;
  original_path: string;
  target_path: string | null;
  status: ActionApplyItem['status'];
  message: string | null;
  undo_status: ActionUndoItem['status'] | 'not_undone';
  undo_message: string | null;
}

function normalizeRelativePath(input: string): string {
  return normalize(input).split('\\').join('/').replace(/^\/+/, '');
}

function isInside(basePath: string, targetPath: string): boolean {
  const rel = relative(basePath, targetPath);
  return rel === '' || (!rel.startsWith('..') && rel !== '..' && !isAbsolute(rel));
}

function resolveTarget(rootPath: string, operationType: ActionPreviewResult['operationType'], proposedPath: string): string {
  if (isAbsolute(proposedPath)) {
    if (operationType !== 'trash') throw new Error('Only trash operations may target an absolute custom folder.');
    return normalize(proposedPath);
  }

  const absoluteTarget = normalize(join(rootPath, normalizeRelativePath(proposedPath)));
  if (!isInside(rootPath, absoluteTarget)) throw new Error('Target path is outside the selected root.');
  return absoluteTarget;
}

function customTrashPath(rootPath: string, relativePath: string): string | null {
  const settings = SettingsService.get();
  if (settings.trashLocationMode !== 'custom') return null;
  if (!settings.customTrashPath.trim()) throw new Error('Custom trash location is not set.');
  return normalize(join(settings.customTrashPath, basename(rootPath), normalizeRelativePath(relativePath)));
}

function recalculateUndoStatus(operationId: string): ActionOperationHistoryItem['undoStatus'] {
  const rows = DatabaseService.get().prepare(`
    SELECT status, undo_status
    FROM action_operation_items
    WHERE operation_id = ?
  `).all(operationId) as Array<{ status: string; undo_status: string }>;

  const applied = rows.filter((row) => row.status === 'applied');
  const undone = applied.filter((row) => row.undo_status === 'undone');
  let undoStatus: ActionOperationHistoryItem['undoStatus'] = 'not_undone';
  if (applied.length > 0 && undone.length === applied.length) undoStatus = 'undone';
  else if (undone.length > 0 || applied.some((row) => row.undo_status === 'failed')) undoStatus = 'partial';

  DatabaseService.get().prepare('UPDATE action_operations SET undo_status = ? WHERE id = ?').run(undoStatus, operationId);
  return undoStatus;
}

async function writeProjectLocalLog(result: ActionApplyResult): Promise<void> {
  const settings = SettingsService.get();
  if (!settings.enableProjectLocalLog) return;

  const logDir = join(result.rootPath, '.file-studio-kh');
  const logPath = join(logDir, 'actions.jsonl');
  try {
    await mkdir(logDir, { recursive: true });

    const lines = result.items.map((item) => JSON.stringify({
      operationId: result.operationId,
      previewId: result.previewId,
      createdAt: result.createdAt,
      operationType: result.operationType,
      rootPath: result.rootPath,
      fileId: item.fileId,
      originalPath: item.originalPath,
      targetPath: item.targetPath,
      status: item.status,
      message: item.message,
    }));

    await appendFile(logPath, `${lines.join('\n')}\n`, 'utf8');
  } catch {
    // Operation history in SQLite remains authoritative if optional project logging fails.
  }
}

export const FileOperationService = {
  async applyPreview(previewId: string): Promise<ActionApplyResult> {
    const db = DatabaseService.get();
    const preview = db.prepare(`
      SELECT id, created_at, root_path, operation_type
      FROM action_previews
      WHERE id = ?
    `).get(previewId) as PreviewRow | undefined;

    if (!preview) throw new Error('Preview not found.');

    const previewItems = db.prepare(`
      SELECT file_id, original_relative_path, proposed_relative_path, status, message
      FROM action_preview_items
      WHERE preview_id = ?
      ORDER BY rowid ASC
    `).all(previewId) as PreviewItemRow[];

    const operationId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const items: ActionApplyItem[] = [];

    // The operation row is written before the first rename and every item is recorded
    // as it happens, so an apply interrupted mid-run (an update, a crash, a power cut)
    // is still listed in History and can still be undone.
    const insertItem = db.prepare(`
      INSERT INTO action_operation_items (
        id, operation_id, file_id, original_path, target_path, status, message
      )
      VALUES (
        @id, @operationId, @fileId, @originalPath, @targetPath, @status, @message
      )
    `);
    const recount = db.prepare(`
      UPDATE action_operations
      SET applied_count = (SELECT COUNT(*) FROM action_operation_items WHERE operation_id = @id AND status = 'applied'),
          failed_count = (SELECT COUNT(*) FROM action_operation_items WHERE operation_id = @id AND status = 'failed'),
          skipped_count = (SELECT COUNT(*) FROM action_operation_items WHERE operation_id = @id AND status = 'skipped')
      WHERE id = @id
    `);
    const record = db.transaction((entry: ActionApplyItem) => {
      insertItem.run({
        id: crypto.randomUUID(),
        operationId,
        fileId: entry.fileId,
        originalPath: entry.originalPath,
        targetPath: entry.targetPath,
        status: entry.status,
        message: entry.message,
      });
      recount.run({ id: operationId });
    });
    const push = (entry: ActionApplyItem): void => {
      items.push(entry);
      record(entry);
    };

    db.prepare(`
      INSERT INTO action_operations (
        id, preview_id, created_at, root_path, operation_type,
        applied_count, failed_count, skipped_count, undo_status
      )
      VALUES (?, ?, ?, ?, ?, 0, 0, 0, 'not_undone')
    `).run(operationId, previewId, createdAt, preview.root_path, preview.operation_type);

    for (const item of previewItems) {
      const originalPath = normalize(join(preview.root_path, item.original_relative_path));
      let targetPath: string | null = null;

      if (item.status !== 'ready' || !item.proposed_relative_path) {
        push({
          fileId: item.file_id,
          originalPath,
          targetPath: null,
          status: 'skipped',
          message: item.message ?? 'Preview item was not ready.',
        });
        continue;
      }

      try {
        const customTrash = preview.operation_type === 'trash'
          ? customTrashPath(preview.root_path, item.original_relative_path)
          : null;
        targetPath = customTrash ?? resolveTarget(preview.root_path, preview.operation_type, item.proposed_relative_path);

        if (!isInside(preview.root_path, originalPath)) throw new Error('Source path is outside the selected root.');
        if (!existsSync(originalPath)) throw new Error('Source file is missing from disk.');
        if (existsSync(targetPath)) throw new Error('A file already exists at the target path.');

        await mkdir(dirname(targetPath), { recursive: true });
        await rename(originalPath, targetPath);

        push({
          fileId: item.file_id,
          originalPath,
          targetPath,
          status: 'applied',
          message: null,
        });
      } catch (error) {
        push({
          fileId: item.file_id,
          originalPath,
          targetPath,
          status: 'failed',
          message: error instanceof Error ? error.message : 'Move failed.',
        });
      }
    }

    const result: ActionApplyResult = {
      operationId,
      previewId,
      createdAt,
      operationType: preview.operation_type,
      rootPath: preview.root_path,
      appliedCount: items.filter((item) => item.status === 'applied').length,
      failedCount: items.filter((item) => item.status === 'failed').length,
      skippedCount: items.filter((item) => item.status === 'skipped').length,
      items,
    };

    await writeProjectLocalLog(result);

    return result;
  },

  listOperations(limit = 50): ActionOperationHistoryItem[] {
    const rows = DatabaseService.get().prepare(`
      SELECT id, preview_id, created_at, root_path, operation_type,
        applied_count, failed_count, skipped_count, undo_status
      FROM action_operations
      ORDER BY created_at DESC
      LIMIT ?
    `).all(Math.min(Math.max(limit, 1), 200)) as OperationRow[];

    return rows.map((row) => ({
      id: row.id,
      previewId: row.preview_id,
      createdAt: row.created_at,
      operationType: row.operation_type,
      rootPath: row.root_path,
      appliedCount: row.applied_count,
      failedCount: row.failed_count,
      skippedCount: row.skipped_count,
      undoStatus: row.undo_status,
    }));
  },

  getOperation(operationId: string): ActionOperationDetail {
    const db = DatabaseService.get();
    const row = db.prepare(`
      SELECT id, preview_id, created_at, root_path, operation_type,
        applied_count, failed_count, skipped_count, undo_status
      FROM action_operations
      WHERE id = ?
    `).get(operationId) as OperationRow | undefined;

    if (!row) throw new Error('Operation not found.');

    const items = db.prepare(`
      SELECT file_id, original_path, target_path, status, message, undo_status, undo_message
      FROM action_operation_items
      WHERE operation_id = ?
      ORDER BY rowid ASC
    `).all(operationId) as OperationItemRow[];

    return {
      id: row.id,
      previewId: row.preview_id,
      createdAt: row.created_at,
      operationType: row.operation_type,
      rootPath: row.root_path,
      appliedCount: row.applied_count,
      failedCount: row.failed_count,
      skippedCount: row.skipped_count,
      undoStatus: row.undo_status,
      items: items.map((item) => ({
        fileId: item.file_id,
        originalPath: item.original_path,
        targetPath: item.target_path,
        status: item.status,
        message: item.message,
        undoStatus: item.undo_status,
        undoMessage: item.undo_message,
      })),
    };
  },

  async undoOperation(operationId: string): Promise<ActionUndoResult> {
    const db = DatabaseService.get();
    const operation = db.prepare('SELECT id FROM action_operations WHERE id = ?').get(operationId) as { id: string } | undefined;
    if (!operation) throw new Error('Operation not found.');

    const rows = db.prepare(`
      SELECT file_id, original_path, target_path, status, message, undo_status, undo_message
      FROM action_operation_items
      WHERE operation_id = ?
      ORDER BY rowid ASC
    `).all(operationId) as OperationItemRow[];

    const updateItem = db.prepare(`
      UPDATE action_operation_items
      SET undo_status = ?, undo_message = ?
      WHERE operation_id = ? AND file_id = ? AND original_path = ? AND target_path = ?
    `);
    const items: ActionUndoItem[] = [];

    for (const row of rows) {
      if (row.status !== 'applied' || !row.target_path) {
        items.push({
          fileId: row.file_id,
          originalPath: row.original_path,
          targetPath: row.target_path ?? '',
          status: 'skipped',
          message: 'Only successfully applied items can be undone.',
        });
        continue;
      }

      if (row.undo_status === 'undone') {
        items.push({
          fileId: row.file_id,
          originalPath: row.original_path,
          targetPath: row.target_path,
          status: 'skipped',
          message: 'Already restored.',
        });
        continue;
      }

      try {
        if (!existsSync(row.target_path)) {
          throw new Error('File is no longer in the trash or target folder. It may have been manually deleted or moved.');
        }
        if (existsSync(row.original_path)) {
          throw new Error('Original location already has a file.');
        }

        await mkdir(dirname(row.original_path), { recursive: true });
        await rename(row.target_path, row.original_path);
        updateItem.run('undone', null, operationId, row.file_id, row.original_path, row.target_path);
        items.push({
          fileId: row.file_id,
          originalPath: row.original_path,
          targetPath: row.target_path,
          status: 'undone',
          message: null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Restore failed.';
        updateItem.run('failed', message, operationId, row.file_id, row.original_path, row.target_path);
        items.push({
          fileId: row.file_id,
          originalPath: row.original_path,
          targetPath: row.target_path,
          status: 'failed',
          message,
        });
      }
    }

    recalculateUndoStatus(operationId);

    return {
      operationId,
      undoneCount: items.filter((item) => item.status === 'undone').length,
      failedCount: items.filter((item) => item.status === 'failed').length,
      skippedCount: items.filter((item) => item.status === 'skipped').length,
      items,
    };
  },
};
