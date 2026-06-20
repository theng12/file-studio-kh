import { basename, dirname, join, normalize, relative } from 'node:path';
import { accessSync, constants, existsSync, statSync } from 'node:fs';
import { dialog, shell } from 'electron';
import { DatabaseService } from './DatabaseService';
import type { RecentRoot } from '../../shared/types/app';

interface RecentRootRow {
  id: string;
  root_path: string;
  label: string;
  last_opened_at: string;
}

function rowToRecentRoot(row: RecentRootRow): RecentRoot {
  return {
    id: row.id,
    rootPath: row.root_path,
    label: row.label,
    lastOpenedAt: row.last_opened_at,
  };
}

function validateRootPath(rootPath: string): void {
  const stat = statSync(rootPath);
  if (!stat.isDirectory()) throw new Error('Selected path is not a folder.');
  accessSync(rootPath, constants.R_OK);
}

function isInsideRoot(rootPath: string, targetPath: string): boolean {
  const rel = relative(rootPath, targetPath);
  return rel === '' || (!rel.startsWith('..') && rel !== '..');
}

function rememberRoot(rootPath: string): RecentRoot {
  validateRootPath(rootPath);
  const now = new Date().toISOString();
  const label = basename(rootPath) || rootPath;
  const id = crypto.randomUUID();
  const db = DatabaseService.get();

  db.prepare(`
    INSERT INTO recent_roots (id, root_path, label, last_opened_at)
    VALUES (@id, @rootPath, @label, @lastOpenedAt)
    ON CONFLICT(root_path) DO UPDATE SET
      label = excluded.label,
      last_opened_at = excluded.last_opened_at
  `).run({ id, rootPath, label, lastOpenedAt: now });

  const row = db.prepare('SELECT * FROM recent_roots WHERE root_path = ?').get(rootPath) as RecentRootRow;
  return rowToRecentRoot(row);
}

export const FolderService = {
  async pickRoot(): Promise<RecentRoot | null> {
    const result = await dialog.showOpenDialog({
      title: 'Choose a folder to scan',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || !result.filePaths[0]) return null;
    return rememberRoot(result.filePaths[0]);
  },

  async pickDirectory(title = 'Choose folder'): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title,
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  },

  validate(rootPath: string): RecentRoot {
    return rememberRoot(rootPath);
  },

  listRecent(): RecentRoot[] {
    const rows = DatabaseService.get()
      .prepare('SELECT * FROM recent_roots ORDER BY last_opened_at DESC LIMIT 12')
      .all() as RecentRootRow[];
    return rows.map(rowToRecentRoot);
  },

  async revealPath(rootPath: string, relativePath = ''): Promise<void> {
    validateRootPath(rootPath);
    const targetPath = normalize(join(rootPath, relativePath));
    if (!isInsideRoot(rootPath, targetPath)) throw new Error('Cannot reveal a path outside the selected root.');

    const revealTarget = existsSync(targetPath)
      ? targetPath
      : dirname(targetPath);
    const error = await shell.openPath(revealTarget);
    if (error) throw new Error(error);
  },

  revealItem(rootPath: string, relativePath: string): void {
    validateRootPath(rootPath);
    const targetPath = normalize(join(rootPath, relativePath));
    if (!isInsideRoot(rootPath, targetPath)) throw new Error('Cannot reveal a path outside the selected root.');
    if (!existsSync(targetPath)) throw new Error('File is missing from disk.');
    shell.showItemInFolder(targetPath);
  },

  async openItem(rootPath: string, relativePath: string): Promise<void> {
    validateRootPath(rootPath);
    const targetPath = normalize(join(rootPath, relativePath));
    if (!isInsideRoot(rootPath, targetPath)) throw new Error('Cannot open a path outside the selected root.');
    if (!existsSync(targetPath)) throw new Error('File is missing from disk.');
    const error = await shell.openPath(targetPath);
    if (error) throw new Error(error);
  },
};
