import { createReadStream, existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, dirname, extname, join, relative } from 'node:path';
import { DatabaseService } from './DatabaseService';
import { SettingsService } from './SettingsService';
import { detectMessiness } from './MessinessService';
import { readImageDimensions, readImagePerceptualHash } from './ThumbnailService';
import type { FileListQuery, FileListResult, FolderTreeItem, ScanProgress, ScanSummary, ScannedFile, TagSummary } from '../../shared/types/app';

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

interface ScanBatchRow {
  id: string;
  root_path: string;
  started_at: string;
  finished_at: string | null;
  status: ScanSummary['status'];
  file_count: number;
  folder_count: number;
  total_bytes: number;
  error_message: string | null;
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.tif', '.tiff', '.bmp', '.heic']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm']);
const DOCUMENT_EXTENSIONS = new Set(['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.json']);
const SOFT_TRASH_FOLDER = '_trash';
const activeCancels = new Set<string>();

function classify(extension: string): ScannedFile['fileType'] {
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (extension === '.pdf') return 'pdf';
  if (VIDEO_EXTENSIONS.has(extension)) return 'video';
  if (DOCUMENT_EXTENSIONS.has(extension)) return 'document';
  return 'other';
}

function isHiddenPath(pathPart: string): boolean {
  return pathPart.split('/').some((part) => part.startsWith('.') && part !== '.');
}

function isSoftTrashPath(relativePath: string): boolean {
  const [firstPart] = relativePath.split('/');
  return firstPart === SOFT_TRASH_FOLDER;
}

function ignoredNames(value: string): Set<string> {
  return new Set(value.split(',').map((item) => item.trim()).filter(Boolean));
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

function hashFile(path: string): Promise<string | null> {
  return new Promise((resolve) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', () => resolve(null));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function latestBatch(): ScanBatchRow | null {
  return DatabaseService.get()
    .prepare('SELECT * FROM scan_batches ORDER BY started_at DESC LIMIT 1')
    .get() as ScanBatchRow | undefined ?? null;
}

function fileQueryWhere(query: FileListQuery): { where: string; params: Record<string, string | number> } {
  const clauses = ['scan_batch_id = @batchId'];
  const params: Record<string, string | number> = {
    batchId: query.batchId,
  };

  if (query.search?.trim()) {
    clauses.push('(filename LIKE @search OR relative_path LIKE @search)');
    params.search = `%${query.search.trim()}%`;
  }

  if (query.folder && query.folder !== '/') {
    clauses.push('(folder_relative_path = @folder OR folder_relative_path LIKE @folderPrefix)');
    params.folder = query.folder;
    params.folderPrefix = `${query.folder}/%`;
  }

  if (query.fileType && query.fileType !== 'all') {
    clauses.push('file_type = @fileType');
    params.fileType = query.fileType;
  }

  if (query.extension && query.extension !== 'all') {
    clauses.push('extension = @extension');
    params.extension = query.extension;
  }

  if (query.tag && query.tag !== 'all') {
    clauses.push('tags_json LIKE @tag');
    params.tag = `%"${query.tag}"%`;
  }

  if (query.status && query.status !== 'all') {
    clauses.push('status = @status');
    params.status = query.status;
  }

  if (Number.isFinite(query.minSizeBytes) && Number(query.minSizeBytes) > 0) {
    clauses.push('size_bytes >= @minSizeBytes');
    params.minSizeBytes = Math.floor(Number(query.minSizeBytes));
  }

  if (Number.isFinite(query.maxSizeBytes) && Number(query.maxSizeBytes) > 0) {
    clauses.push('size_bytes <= @maxSizeBytes');
    params.maxSizeBytes = Math.floor(Number(query.maxSizeBytes));
  }

  if (query.modifiedAfter?.trim()) {
    const modifiedAfter = new Date(query.modifiedAfter);
    if (!Number.isNaN(modifiedAfter.getTime())) {
      clauses.push('modified_at >= @modifiedAfter');
      params.modifiedAfter = modifiedAfter.toISOString();
    }
  }

  if (query.modifiedBefore?.trim()) {
    const modifiedBefore = new Date(`${query.modifiedBefore}T23:59:59.999`);
    if (!Number.isNaN(modifiedBefore.getTime())) {
      clauses.push('modified_at <= @modifiedBefore');
      params.modifiedBefore = modifiedBefore.toISOString();
    }
  }

  return { where: clauses.join(' AND '), params };
}

export const ScanService = {
  async start(rootPath: string, onProgress?: (progress: ScanProgress) => void): Promise<ScanSummary> {
    const settings = SettingsService.get();
    const db = DatabaseService.get();
    const batchId = crypto.randomUUID();
    const ignored = ignoredNames(settings.ignoredFolderNames);
    const startedAt = new Date().toISOString();
    let fileCount = 0;
    let folderCount = 0;
    let totalBytes = 0;

    db.prepare(`
      INSERT INTO scan_batches (id, root_path, started_at, status)
      VALUES (?, ?, ?, 'running')
    `).run(batchId, rootPath, startedAt);

    const emitProgress = (status: ScanProgress['status'], currentPath: string, message: string): void => {
      onProgress?.({
        batchId,
        rootPath,
        status,
        currentPath,
        fileCount,
        folderCount,
        totalBytes,
        message,
      });
    };

    const throwIfCancelled = (): void => {
      if (activeCancels.has(batchId)) {
        throw new Error('SCAN_CANCELLED');
      }
    };

    emitProgress('running', rootPath, 'Starting scan');

    const insertFile = db.prepare(`
      INSERT INTO scanned_files (
        id, scan_batch_id, root_path, relative_path, folder_relative_path,
        filename, extension, file_type, size_bytes, modified_at, width, height, tags_json, status, content_hash, perceptual_hash
      )
      VALUES (
        @id, @scanBatchId, @rootPath, @relativePath, @folderRelativePath,
        @filename, @extension, @fileType, @sizeBytes, @modifiedAt, @width, @height, @tagsJson, @status, @contentHash, @perceptualHash
      )
    `);

    const scanDirectory = async (absoluteDir: string, depth: number): Promise<void> => {
      throwIfCancelled();
      if (depth > settings.scanDepth) return;
      const entries = await readdir(absoluteDir, { withFileTypes: true });
      emitProgress('running', absoluteDir, `Scanning ${relative(rootPath, absoluteDir) || '/'}`);

      for (const entry of entries) {
        throwIfCancelled();
        const absolutePath = join(absoluteDir, entry.name);
        const relativePath = relative(rootPath, absolutePath).split('\\').join('/');
        if (!settings.includeHidden && isHiddenPath(relativePath)) continue;
        if (isSoftTrashPath(relativePath)) continue;

        if (entry.isDirectory()) {
          if (ignored.has(entry.name)) continue;
          folderCount += 1;
          await scanDirectory(absolutePath, depth + 1);
          continue;
        }

        if (!entry.isFile()) continue;

        const fileStat = await stat(absolutePath);
        const extension = extname(entry.name).toLowerCase();
        const fileType = classify(extension);
        const dimensions = fileType === 'image'
          ? await readImageDimensions(absolutePath)
          : { width: null, height: null };
        const perceptualHash = fileType === 'image'
          ? await readImagePerceptualHash(absolutePath)
          : null;
        const contentHash = await hashFile(absolutePath);
        const tags = detectMessiness({
          filename: entry.name,
          extension,
          fileType,
          sizeBytes: fileStat.size,
        });
        const folderRelativePath = dirname(relativePath) === '.' ? '' : dirname(relativePath).split('\\').join('/');

        insertFile.run({
          id: crypto.randomUUID(),
          scanBatchId: batchId,
          rootPath,
          relativePath,
          folderRelativePath,
          filename: basename(entry.name),
          extension: extension || '(none)',
          fileType,
          sizeBytes: fileStat.size,
          modifiedAt: fileStat.mtime.toISOString(),
          width: dimensions.width,
          height: dimensions.height,
          tagsJson: JSON.stringify(tags),
          status: tags.length > 0 ? 'needs_review' : 'organized',
          contentHash,
          perceptualHash,
        });

        fileCount += 1;
        totalBytes += fileStat.size;
        if (fileCount % 25 === 0) {
          emitProgress('running', absolutePath, `Scanned ${fileCount.toLocaleString()} files`);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    };

    try {
      await scanDirectory(rootPath, 0);
      db.prepare(`
        UPDATE scan_batches
        SET finished_at = ?, status = 'completed', file_count = ?, folder_count = ?, total_bytes = ?
        WHERE id = ?
      `).run(new Date().toISOString(), fileCount, folderCount, totalBytes, batchId);
      emitProgress('completed', rootPath, `Completed ${fileCount.toLocaleString()} files`);
    } catch (error) {
      const cancelled = error instanceof Error && error.message === 'SCAN_CANCELLED';
      db.prepare(`
        UPDATE scan_batches
        SET finished_at = ?, status = ?, file_count = ?, folder_count = ?, total_bytes = ?, error_message = ?
        WHERE id = ?
      `).run(
        new Date().toISOString(),
        cancelled ? 'cancelled' : 'failed',
        fileCount,
        folderCount,
        totalBytes,
        cancelled ? 'Scan cancelled' : error instanceof Error ? error.message : 'Scan failed',
        batchId,
      );
      emitProgress(cancelled ? 'cancelled' : 'failed', rootPath, cancelled ? 'Scan cancelled' : 'Scan failed');
    } finally {
      activeCancels.delete(batchId);
    }

    return this.getSummary(batchId);
  },

  cancel(batchId: string): boolean {
    activeCancels.add(batchId);
    return true;
  },

  getSummary(batchId?: string): ScanSummary {
    const db = DatabaseService.get();
    const batch = batchId
      ? db.prepare('SELECT * FROM scan_batches WHERE id = ?').get(batchId) as ScanBatchRow | undefined
      : latestBatch();

    if (!batch) {
      throw new Error('No scan has been run yet.');
    }

    const byExtension = db.prepare(`
      SELECT extension, COUNT(*) AS count
      FROM scanned_files
      WHERE scan_batch_id = ?
      GROUP BY extension
      ORDER BY count DESC, extension ASC
      LIMIT 24
    `).all(batch.id) as Array<{ extension: string; count: number }>;

    const byType = db.prepare(`
      SELECT file_type AS fileType, COUNT(*) AS count
      FROM scanned_files
      WHERE scan_batch_id = ?
      GROUP BY file_type
      ORDER BY count DESC
    `).all(batch.id) as Array<{ fileType: string; count: number }>;

    const largestFolders = db.prepare(`
      SELECT folder_relative_path AS relativePath, COUNT(*) AS fileCount, SUM(size_bytes) AS totalBytes
      FROM scanned_files
      WHERE scan_batch_id = ?
      GROUP BY folder_relative_path
      ORDER BY totalBytes DESC
      LIMIT 6
    `).all(batch.id) as Array<{ relativePath: string; fileCount: number; totalBytes: number }>;

    const recentRows = db.prepare(`
      SELECT * FROM scanned_files
      WHERE scan_batch_id = ?
      ORDER BY modified_at DESC
      LIMIT 8
    `).all(batch.id) as ScannedFileRow[];

    const messyCount = db.prepare(`
      SELECT COUNT(*) AS count
      FROM scanned_files
      WHERE scan_batch_id = ? AND tags_json != '[]'
    `).get(batch.id) as { count: number };

    const settings = SettingsService.get();
    const warnings: string[] = [];
    if (!settings.includeHidden) warnings.push('Hidden files and folders are skipped.');
    if (settings.ignoredFolderNames.trim()) warnings.push(`Ignored folders: ${settings.ignoredFolderNames}`);
    if (existsSync(join(batch.root_path, SOFT_TRASH_FOLDER))) warnings.push('Root _trash exists and is hidden from active scan results.');
    if (batch.file_count >= 1000) warnings.push('Large scan: review filters and previews carefully before applying changes.');

    return {
      batchId: batch.id,
      rootPath: batch.root_path,
      status: batch.status,
      startedAt: batch.started_at,
      finishedAt: batch.finished_at,
      fileCount: batch.file_count,
      folderCount: batch.folder_count,
      totalBytes: batch.total_bytes,
      byExtension,
      byType,
      largestFolders,
      recentFiles: recentRows.map(rowToFile),
      messyCount: messyCount.count,
      warnings,
      errorMessage: batch.error_message ?? undefined,
    };
  },

  listFiles(query: FileListQuery): FileListResult {
    const db = DatabaseService.get();
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);
    const { where, params } = fileQueryWhere(query);
    const queryParams = {
      ...params,
      limit,
      offset,
    };
    const rows = db.prepare(`
      SELECT * FROM scanned_files
      WHERE ${where}
      ORDER BY folder_relative_path ASC, filename ASC
      LIMIT @limit OFFSET @offset
    `).all(queryParams) as ScannedFileRow[];

    const total = db.prepare(`SELECT COUNT(*) AS count FROM scanned_files WHERE ${where}`)
      .get(params) as { count: number };

    return {
      files: rows.map(rowToFile),
      total: total.count,
      limit,
      offset,
    };
  },

  listFileIds(query: FileListQuery): string[] {
    const { where, params } = fileQueryWhere(query);
    const rows = DatabaseService.get().prepare(`
      SELECT id
      FROM scanned_files
      WHERE ${where}
      ORDER BY folder_relative_path ASC, filename ASC
    `).all(params) as Array<{ id: string }>;

    return rows.map((row) => row.id);
  },

  updateFileStatus(batchId: string, fileIds: string[], status: ScannedFile['status']): number {
    const allowed: ScannedFile['status'][] = ['organized', 'approved', 'needs_review', 'reference', 'trash_candidate'];
    if (!allowed.includes(status)) throw new Error('Unsupported review status.');
    if (fileIds.length === 0) return 0;

    const placeholders = fileIds.map(() => '?').join(',');
    const result = DatabaseService.get().prepare(`
      UPDATE scanned_files
      SET status = ?
      WHERE scan_batch_id = ? AND id IN (${placeholders})
    `).run(status, batchId, ...fileIds);

    return Number(result.changes);
  },

  listFolders(batchId: string): FolderTreeItem[] {
    const rows = DatabaseService.get().prepare(`
      SELECT folder_relative_path AS relativePath, COUNT(*) AS fileCount, SUM(size_bytes) AS totalBytes
      FROM scanned_files
      WHERE scan_batch_id = ?
      GROUP BY folder_relative_path
      ORDER BY folder_relative_path ASC
    `).all(batchId) as Array<{ relativePath: string; fileCount: number; totalBytes: number }>;

    return rows.map((row) => {
      const relativePath = row.relativePath || '/';
      const parts = relativePath === '/' ? [] : relativePath.split('/');
      return {
        relativePath,
        name: parts.at(-1) ?? '/',
        depth: Math.max(parts.length - 1, 0),
        fileCount: row.fileCount,
        totalBytes: row.totalBytes ?? 0,
      };
    });
  },

  listTags(batchId: string): TagSummary[] {
    const rows = DatabaseService.get().prepare(`
      SELECT tags_json AS tagsJson
      FROM scanned_files
      WHERE scan_batch_id = ? AND tags_json != '[]'
    `).all(batchId) as Array<{ tagsJson: string }>;

    const counts = new Map<string, number>();
    for (const row of rows) {
      try {
        const tags = JSON.parse(row.tagsJson) as string[];
        for (const tag of tags) {
          counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
      } catch {
        // Ignore malformed tag payloads from older/dev databases.
      }
    }

    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  },
};
