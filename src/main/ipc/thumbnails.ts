import { join, normalize, relative } from 'node:path';
import { ipcMain } from 'electron';
import { ThumbnailService } from '../services/ThumbnailService';

function resolveInsideRoot(rootPath: string, relativePath: string): string {
  const absolute = normalize(join(rootPath, relativePath));
  const rel = relative(rootPath, absolute);
  if (rel.startsWith('..') || rel === '..') {
    throw new Error('Thumbnail path is outside the selected root.');
  }
  return absolute;
}

export function registerThumbnailIpc(): void {
  ipcMain.handle('thumbnails:get', (_event, rootPath: string, relativePath: string) =>
    ThumbnailService.getDataUrl(resolveInsideRoot(rootPath, relativePath)),
  );
  ipcMain.handle('thumbnails:getCacheStats', () => ThumbnailService.stats());
  ipcMain.handle('thumbnails:clearCache', () => ThumbnailService.clear());
  ipcMain.handle('thumbnails:enforceCacheLimit', () => ThumbnailService.enforceLimit());
}
