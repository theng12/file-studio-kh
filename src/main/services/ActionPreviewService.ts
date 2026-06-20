import { existsSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, normalize, relative } from 'node:path';
import { DatabaseService } from './DatabaseService';
import { SettingsService } from './SettingsService';
import type { ActionPreviewHistoryItem, ActionPreviewItem, ActionPreviewRequest, ActionPreviewResult } from '../../shared/types/app';

const SOFT_TRASH_FOLDER = '_trash';

interface PreviewFileRow {
  id: string;
  root_path: string;
  relative_path: string;
  filename: string;
  extension: string;
  file_type: string;
  size_bytes: number;
}

interface ActionPreviewRow {
  id: string;
  created_at: string;
  root_path: string;
  operation_type: ActionPreviewResult['operationType'];
  request_json?: string;
  item_count: number;
  ready_count: number;
  conflict_count: number;
  invalid_count: number;
  skipped_count: number;
  affected_bytes: number;
  folders_to_create_json?: string;
}

interface ActionPreviewItemRow {
  file_id: string;
  original_relative_path: string;
  proposed_relative_path: string | null;
  status: ActionPreviewItem['status'];
  message: string | null;
}

function normalizeRelativePath(input: string): string {
  return normalize(input).split('\\').join('/').replace(/^\/+/, '');
}

function isUnsafeRelativePath(path: string): boolean {
  const normalized = normalizeRelativePath(path);
  return normalized === '' || normalized === '.' || normalized.startsWith('../') || normalized.includes('\0');
}

function invalidFilename(filename: string): string | null {
  if (!filename.trim()) return 'Filename would be empty.';
  if (filename.includes('/') || filename.includes('\0')) return 'Filename contains invalid path characters.';
  return null;
}

function isInSoftTrash(relativePath: string): boolean {
  const [firstPart] = normalizeRelativePath(relativePath).split('/');
  return firstPart === SOFT_TRASH_FOLDER;
}

function applyRename(filename: string, operation: ActionPreviewRequest['operation']): string {
  if (operation.type !== 'rename') return filename;

  const extension = extname(filename);
  let stem = extension ? filename.slice(0, -extension.length) : filename;

  if (operation.removeText) stem = stem.split(operation.removeText).join('');
  if (operation.replaceFrom) stem = stem.split(operation.replaceFrom).join(operation.replaceTo ?? '');
  if (operation.prefix) stem = `${operation.prefix}${stem}`;
  if (operation.suffix) stem = `${stem}${operation.suffix}`;

  return `${stem}${extension}`;
}

function normalizeExtensionName(filename: string, casing: 'lower' | 'upper'): string {
  const extension = extname(filename);
  if (!extension) return filename;
  const stem = filename.slice(0, -extension.length);
  return `${stem}${casing === 'upper' ? extension.toUpperCase() : extension.toLowerCase()}`;
}

function formatFolder(row: PreviewFileRow): string {
  const extension = row.extension.toLowerCase();
  if (extension === '.pdf') return '_pdf';
  if (extension === '.png') return '_png';
  if (['.raw', '.arw', '.cr2', '.cr3', '.nef', '.dng', '.orf', '.raf', '.rw2'].includes(extension)) return '_raw';
  return '_other';
}

export function extractProductCode(filename: string): string | null {
  const stem = basename(filename, extname(filename)).toUpperCase();
  const match = stem.match(/\b[A-Z]{1,4}[-_ ]?[A-Z0-9]{2,}(?:[-_ ][A-Z0-9]{1,}){0,4}\b/);
  if (!match) return null;
  return match[0].replace(/[_ ]+/g, '-');
}

function proposedPath(row: PreviewFileRow, request: ActionPreviewRequest, index: number): string | null {
  if (request.operation.type === 'trash') {
    const settings = SettingsService.get();
    if (settings.trashLocationMode === 'custom') {
      if (!settings.customTrashPath.trim()) return null;
      return normalize(join(settings.customTrashPath, basename(request.rootPath), row.relative_path));
    }
    return normalizeRelativePath(join('_trash', row.relative_path));
  }

  if (request.operation.type === 'move') {
    const target = normalizeRelativePath(request.operation.targetFolder);
    return normalizeRelativePath(join(target, basename(row.relative_path)));
  }

  if (request.operation.type === 'normalizeExtension') {
    return normalizeRelativePath(join(dirname(row.relative_path), normalizeExtensionName(row.filename, request.operation.casing)));
  }

  if (request.operation.type === 'isolateFormat') {
    return normalizeRelativePath(join(formatFolder(row), basename(row.relative_path)));
  }

  if (request.operation.type === 'productFolders') {
    const code = extractProductCode(row.filename);
    if (!code) return null;
    return normalizeRelativePath(join(code, basename(row.relative_path)));
  }

  if (request.operation.type === 'suggestedRename') {
    const suggestion = request.operation.suggestions.find((item) => item.fileId === row.id);
    if (!suggestion) return null;
    return normalizeRelativePath(join(dirname(row.relative_path), suggestion.suggestedName));
  }

  if (request.operation.type === 'sequence') {
    const extension = extname(row.filename);
    const safeBase = request.operation.baseName.trim();
    const nextNumber = request.operation.start + index;
    const padded = String(nextNumber).padStart(request.operation.padding, '0');
    const separator = request.operation.separator;
    return normalizeRelativePath(join(dirname(row.relative_path), `${safeBase}${separator}${padded}${extension}`));
  }

  const nextName = applyRename(row.filename, request.operation);
  return normalizeRelativePath(join(dirname(row.relative_path), nextName));
}

export const ActionPreviewService = {
  preview(request: ActionPreviewRequest): ActionPreviewResult {
    const previewId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    if (request.fileIds.length === 0) {
      const emptyResult: ActionPreviewResult = {
        previewId,
        createdAt,
        operationType: request.operation.type,
        rootPath: request.rootPath,
        itemCount: 0,
        readyCount: 0,
        conflictCount: 0,
        invalidCount: 0,
        skippedCount: 0,
        affectedBytes: 0,
        foldersToCreate: [],
        items: [],
      };
      this.persist(request, emptyResult);
      return emptyResult;
    }

    const db = DatabaseService.get();
    const placeholders = request.fileIds.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT id, root_path, relative_path, filename, extension, file_type, size_bytes
      FROM scanned_files
      WHERE scan_batch_id = ? AND id IN (${placeholders})
      ORDER BY folder_relative_path ASC, filename ASC
    `).all(request.batchId, ...request.fileIds) as PreviewFileRow[];

    const found = new Set(rows.map((row) => row.id));
    const items: ActionPreviewItem[] = [];
    const proposedSet = new Set<string>();
    const foldersToCreate = new Set<string>();

    for (const missingId of request.fileIds.filter((id) => !found.has(id))) {
      items.push({
        fileId: missingId,
        originalRelativePath: '',
        proposedRelativePath: null,
        status: 'skipped',
        message: 'File is not part of the current scan.',
      });
    }

    rows.forEach((row, index) => {
      const next = proposedPath(row, request, index);
      const item: ActionPreviewItem = {
        fileId: row.id,
        originalRelativePath: row.relative_path,
        proposedRelativePath: next,
        status: 'ready',
        message: null,
      };

      if (row.root_path !== request.rootPath) {
        item.status = 'skipped';
        item.message = 'File belongs to a different root.';
      } else if (request.operation.type === 'trash' && isInSoftTrash(row.relative_path)) {
        item.status = 'skipped';
        item.message = 'File is already in _trash.';
      } else if (!next || isUnsafeRelativePath(next)) {
        item.status = 'invalid';
        item.message = request.operation.type === 'trash'
          ? 'Trash location is not configured.'
          : request.operation.type === 'productFolders'
            ? 'No product code was found in the filename.'
            : request.operation.type === 'suggestedRename'
              ? 'No filename suggestion was available for this file.'
            : 'Proposed path is invalid.';
      } else {
        const filenameError = invalidFilename(basename(next));
        const absoluteSource = normalize(join(request.rootPath, row.relative_path));
        const absoluteTarget = isAbsolute(next) ? normalize(next) : normalize(join(request.rootPath, next));
        const rootRel = relative(request.rootPath, absoluteTarget);

        if (filenameError) {
          item.status = 'invalid';
          item.message = filenameError;
        } else if (!isAbsolute(next) && (rootRel.startsWith('..') || rootRel === '..')) {
          item.status = 'invalid';
          item.message = 'Proposed path is outside the selected root.';
        } else if (isAbsolute(next) && request.operation.type !== 'trash') {
          item.status = 'invalid';
          item.message = 'Only trash operations can use a custom absolute destination.';
        } else if (!existsSync(absoluteSource)) {
          item.status = 'skipped';
          item.message = 'Source file is missing from disk.';
        } else if (next === row.relative_path) {
          item.status = 'skipped';
          item.message = 'No path change.';
        } else if (proposedSet.has(next)) {
          item.status = 'conflict';
          item.message = 'Multiple selected files would target the same path.';
        } else if (existsSync(absoluteTarget)) {
          item.status = 'conflict';
          item.message = 'A file already exists at the proposed path.';
        } else {
          const targetFolder = dirname(next);
          if (targetFolder && targetFolder !== '.' && targetFolder !== dirname(row.relative_path)) {
            const absoluteFolder = normalize(join(request.rootPath, targetFolder));
            if (!existsSync(absoluteFolder)) foldersToCreate.add(targetFolder);
          }
        }
      }

      if (next) proposedSet.add(next);
      items.push(item);
    });

    const result: ActionPreviewResult = {
      previewId,
      createdAt,
      operationType: request.operation.type,
      rootPath: request.rootPath,
      itemCount: items.length,
      readyCount: items.filter((item) => item.status === 'ready').length,
      conflictCount: items.filter((item) => item.status === 'conflict').length,
      invalidCount: items.filter((item) => item.status === 'invalid').length,
      skippedCount: items.filter((item) => item.status === 'skipped').length,
      affectedBytes: items.reduce((total, item) => {
        if (item.status !== 'ready') return total;
        const row = rows.find((candidate) => candidate.id === item.fileId);
        return total + (row?.size_bytes ?? 0);
      }, 0),
      foldersToCreate: Array.from(foldersToCreate).sort(),
      items,
    };

    this.persist(request, result);
    return result;
  },

  persist(request: ActionPreviewRequest, result: ActionPreviewResult): void {
    const db = DatabaseService.get();
    const insertPreview = db.prepare(`
      INSERT INTO action_previews (
        id, created_at, root_path, operation_type, request_json, item_count,
        ready_count, conflict_count, invalid_count, skipped_count, affected_bytes, folders_to_create_json
      )
      VALUES (
        @id, @createdAt, @rootPath, @operationType, @requestJson, @itemCount,
        @readyCount, @conflictCount, @invalidCount, @skippedCount, @affectedBytes, @foldersToCreateJson
      )
    `);
    const insertItem = db.prepare(`
      INSERT INTO action_preview_items (
        id, preview_id, file_id, original_relative_path, proposed_relative_path, status, message
      )
      VALUES (
        @id, @previewId, @fileId, @originalRelativePath, @proposedRelativePath, @status, @message
      )
    `);

    const tx = db.transaction(() => {
      insertPreview.run({
        id: result.previewId,
        createdAt: result.createdAt,
        rootPath: result.rootPath,
        operationType: result.operationType,
        requestJson: JSON.stringify(request),
        itemCount: result.itemCount,
        readyCount: result.readyCount,
        conflictCount: result.conflictCount,
        invalidCount: result.invalidCount,
        skippedCount: result.skippedCount,
        affectedBytes: result.affectedBytes,
        foldersToCreateJson: JSON.stringify(result.foldersToCreate),
      });

      for (const item of result.items) {
        insertItem.run({
          id: crypto.randomUUID(),
          previewId: result.previewId,
          fileId: item.fileId,
          originalRelativePath: item.originalRelativePath,
          proposedRelativePath: item.proposedRelativePath,
          status: item.status,
          message: item.message,
        });
      }
    });

    tx();
  },

  listPreviews(limit = 50): ActionPreviewHistoryItem[] {
    const rows = DatabaseService.get().prepare(`
      SELECT id, created_at, root_path, operation_type, item_count, ready_count,
        conflict_count, invalid_count, skipped_count, affected_bytes
      FROM action_previews
      ORDER BY created_at DESC
      LIMIT ?
    `).all(Math.min(Math.max(limit, 1), 200)) as ActionPreviewRow[];

    return rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      operationType: row.operation_type,
      rootPath: row.root_path,
      itemCount: row.item_count,
      readyCount: row.ready_count,
      conflictCount: row.conflict_count,
      invalidCount: row.invalid_count,
      skippedCount: row.skipped_count,
      affectedBytes: row.affected_bytes ?? 0,
    }));
  },

  getPreview(previewId: string): ActionPreviewResult {
    const db = DatabaseService.get();
    const row = db.prepare(`
      SELECT id, created_at, root_path, operation_type, item_count, ready_count,
        conflict_count, invalid_count, skipped_count, affected_bytes, folders_to_create_json
      FROM action_previews
      WHERE id = ?
    `).get(previewId) as ActionPreviewRow | undefined;

    if (!row) throw new Error('Preview not found.');

    const itemRows = db.prepare(`
      SELECT file_id, original_relative_path, proposed_relative_path, status, message
      FROM action_preview_items
      WHERE preview_id = ?
      ORDER BY rowid ASC
    `).all(previewId) as ActionPreviewItemRow[];

    return {
      previewId: row.id,
      createdAt: row.created_at,
      operationType: row.operation_type,
      rootPath: row.root_path,
      itemCount: row.item_count,
      readyCount: row.ready_count,
      conflictCount: row.conflict_count,
      invalidCount: row.invalid_count,
      skippedCount: row.skipped_count,
      affectedBytes: row.affected_bytes ?? 0,
      foldersToCreate: row.folders_to_create_json ? JSON.parse(row.folders_to_create_json) as string[] : [],
      items: itemRows.map((item) => ({
        fileId: item.file_id,
        originalRelativePath: item.original_relative_path,
        proposedRelativePath: item.proposed_relative_path,
        status: item.status,
        message: item.message,
      })),
    };
  },

  revalidatePreview(previewId: string): ActionPreviewResult {
    const row = DatabaseService.get().prepare(`
      SELECT request_json
      FROM action_previews
      WHERE id = ?
    `).get(previewId) as { request_json: string } | undefined;

    if (!row) throw new Error('Preview not found.');
    return this.preview(JSON.parse(row.request_json) as ActionPreviewRequest);
  },
};
