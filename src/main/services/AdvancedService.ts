import { writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { dialog } from 'electron';
import { DatabaseService } from './DatabaseService';
import { SettingsService } from './SettingsService';
import { extractProductCode } from './ActionPreviewService';
import type { DuplicateGroup, FilenameSuggestion, NearDuplicateGroup, ProductCodeGroup, ScannedFile } from '../../shared/types/app';

interface ScannedFileRow {
  id: string;
  scan_batch_id: string;
  root_path: string;
  relative_path: string;
  folder_relative_path: string;
  filename: string;
  extension: string;
  file_type: ScannedFile['fileType'];
  size_bytes: number;
  modified_at: string;
  width: number | null;
  height: number | null;
  tags_json: string;
  status: ScannedFile['status'];
  content_hash: string | null;
  perceptual_hash: string | null;
}

interface OperationExportRow {
  id: string;
  created_at: string;
  root_path: string;
  operation_type: string;
  applied_count: number;
  failed_count: number;
  skipped_count: number;
  undo_status: string;
  file_id: string;
  original_path: string;
  target_path: string | null;
  status: string;
  message: string | null;
  undo_message: string | null;
}

function rowToFile(row: ScannedFileRow): ScannedFile {
  return {
    id: row.id,
    scanBatchId: row.scan_batch_id,
    rootPath: row.root_path,
    relativePath: row.relative_path,
    folderRelativePath: row.folder_relative_path,
    filename: row.filename,
    extension: row.extension,
    fileType: row.file_type,
    sizeBytes: row.size_bytes,
    modifiedAt: row.modified_at,
    width: row.width,
    height: row.height,
    tags: JSON.parse(row.tags_json) as string[],
    status: row.status,
    contentHash: row.content_hash,
    perceptualHash: row.perceptual_hash,
  };
}

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  return [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ].join('\n');
}

function cleanupSuggestion(filename: string): { suggestedName: string; reason: string } | null {
  const extension = extname(filename);
  const stem = extension ? filename.slice(0, -extension.length) : filename;
  let next = stem
    .replace(/\bcopy\b/gi, '')
    .replace(/final[\s_-]*final/gi, 'final')
    .replace(/\b(new|large|small|edited)\b/gi, '')
    .replace(/[ _]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!next) next = stem.trim();
  const suggestedName = `${next}${extension.toLowerCase()}`;
  if (suggestedName === filename) return null;
  return { suggestedName, reason: 'Cleaned copy/final/generic words, repeated separators, and extension casing.' };
}

function hammingHex(a: string, b: string): number {
  let distance = 0;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    let value = Number.parseInt(a[index], 16) ^ Number.parseInt(b[index], 16);
    while (value > 0) {
      distance += value & 1;
      value >>= 1;
    }
  }
  return distance + Math.abs(a.length - b.length) * 4;
}

async function saveCsv(defaultName: string, rows: Array<Record<string, unknown>>): Promise<string | null> {
  const settings = SettingsService.get();
  const result = await dialog.showSaveDialog({
    title: `Export ${defaultName}`,
    defaultPath: join(settings.defaultSaveLocation, defaultName),
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (result.canceled || !result.filePath) return null;
  await writeFile(result.filePath, `${toCsv(rows)}\n`, 'utf8');
  return result.filePath;
}

export const AdvancedService = {
  duplicateGroups(batchId: string): DuplicateGroup[] {
    const hashRows = DatabaseService.get().prepare(`
      SELECT content_hash AS key, COUNT(*) AS count, SUM(size_bytes) AS totalBytes
      FROM scanned_files
      WHERE scan_batch_id = ? AND content_hash IS NOT NULL
      GROUP BY content_hash
      HAVING count > 1
      ORDER BY totalBytes DESC
      LIMIT 50
    `).all(batchId) as Array<{ key: string; count: number; totalBytes: number }>;

    const fileQuery = DatabaseService.get().prepare(`
      SELECT * FROM scanned_files
      WHERE scan_batch_id = ? AND content_hash = ?
      ORDER BY folder_relative_path ASC, filename ASC
    `);

    return hashRows.map((group) => ({
      key: group.key,
      totalBytes: group.totalBytes,
      files: (fileQuery.all(batchId, group.key) as ScannedFileRow[]).map(rowToFile),
    }));
  },

  nearDuplicateGroups(batchId: string, maxDistance = 8): NearDuplicateGroup[] {
    const rows = DatabaseService.get().prepare(`
      SELECT * FROM scanned_files
      WHERE scan_batch_id = ? AND perceptual_hash IS NOT NULL
      ORDER BY folder_relative_path ASC, filename ASC
      LIMIT 800
    `).all(batchId) as ScannedFileRow[];

    const files = rows.map(rowToFile);
    const groups: NearDuplicateGroup[] = [];
    const used = new Set<string>();
    for (let i = 0; i < files.length; i += 1) {
      const first = files[i];
      if (!first.perceptualHash || used.has(first.id)) continue;
      const matches: ScannedFile[] = [first];
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let j = i + 1; j < files.length; j += 1) {
        const next = files[j];
        if (!next.perceptualHash || used.has(next.id)) continue;
        const distance = hammingHex(first.perceptualHash, next.perceptualHash);
        if (distance <= maxDistance) {
          matches.push(next);
          bestDistance = Math.min(bestDistance, distance);
        }
      }
      if (matches.length > 1) {
        matches.forEach((file) => used.add(file.id));
        groups.push({
          id: first.perceptualHash,
          distance: Number.isFinite(bestDistance) ? bestDistance : 0,
          files: matches,
        });
      }
    }
    return groups.slice(0, 50);
  },

  filenameSuggestions(batchId: string): FilenameSuggestion[] {
    const rows = DatabaseService.get().prepare(`
      SELECT * FROM scanned_files
      WHERE scan_batch_id = ?
      ORDER BY folder_relative_path ASC, filename ASC
      LIMIT 500
    `).all(batchId) as ScannedFileRow[];

    return rows.flatMap((row) => {
      const suggestion = cleanupSuggestion(row.filename);
      if (!suggestion) return [];
      return [{
        fileId: row.id,
        relativePath: row.relative_path,
        currentName: row.filename,
        suggestedName: suggestion.suggestedName,
        reason: suggestion.reason,
      }];
    }).slice(0, 100);
  },

  productCodeGroups(batchId: string): ProductCodeGroup[] {
    const rows = DatabaseService.get().prepare(`
      SELECT * FROM scanned_files
      WHERE scan_batch_id = ?
      ORDER BY folder_relative_path ASC, filename ASC
    `).all(batchId) as ScannedFileRow[];

    const groups = new Map<string, ScannedFile[]>();
    for (const row of rows) {
      const code = extractProductCode(row.filename);
      if (!code) continue;
      groups.set(code, [...(groups.get(code) ?? []), rowToFile(row)]);
    }

    return Array.from(groups.entries())
      .map(([code, files]) => ({ code, count: files.length, files }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
      .slice(0, 100);
  },

  async exportScanCsv(batchId: string): Promise<string | null> {
    const rows = DatabaseService.get().prepare(`
      SELECT relative_path, folder_relative_path, filename, extension, file_type,
        size_bytes, modified_at, width, height, status, tags_json, content_hash, perceptual_hash
      FROM scanned_files
      WHERE scan_batch_id = ?
      ORDER BY folder_relative_path ASC, filename ASC
    `).all(batchId) as Array<Record<string, unknown>>;

    return saveCsv('file-studio-kh-scan.csv', rows.map((row) => ({
      ...row,
      tags: row.tags_json,
      tags_json: undefined,
    })));
  },

  async exportOperationsCsv(): Promise<string | null> {
    const rows = DatabaseService.get().prepare(`
      SELECT o.id, o.created_at, o.root_path, o.operation_type, o.applied_count,
        o.failed_count, o.skipped_count, o.undo_status, i.file_id, i.original_path,
        i.target_path, i.status, i.message, i.undo_message
      FROM action_operations o
      LEFT JOIN action_operation_items i ON i.operation_id = o.id
      ORDER BY o.created_at DESC, i.rowid ASC
    `).all() as OperationExportRow[];

    return saveCsv('file-studio-kh-operation-history.csv', rows.map((row) => ({ ...row })));
  },
};
