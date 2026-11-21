import { ipcMain } from 'electron';
import { FSWatcher, watch } from 'node:fs';
import { ScanService } from '../services/ScanService';
import { guardedWork } from '../services/UpdateHoldService';
import type { FileListQuery, ScannedFile } from '../../shared/types/app';

let watcher: FSWatcher | null = null;
let lastWatchEventAt = 0;

export function registerScanIpc(): void {
  ipcMain.handle('scan:start', (event, rootPath: string) =>
    guardedWork('scan', () => ScanService.start(rootPath, (progress) => {
      event.sender.send('scan:progress', progress);
    })),
  );
  ipcMain.handle('scan:cancel', (_event, batchId: string) => ScanService.cancel(batchId));
  ipcMain.handle('scan:getSummary', (_event, batchId?: string) => ScanService.getSummary(batchId));
  ipcMain.handle('scan:listFolders', (_event, batchId: string) => ScanService.listFolders(batchId));
  ipcMain.handle('scan:listTags', (_event, batchId: string) => ScanService.listTags(batchId));
  ipcMain.handle('scan:watchRoot', (event, rootPath: string) => {
    watcher?.close();
    watcher = watch(rootPath, { recursive: true }, (eventType, filename) => {
      const now = Date.now();
      if (now - lastWatchEventAt < 1500) return;
      lastWatchEventAt = now;
      event.sender.send('scan:watchEvent', {
        rootPath,
        eventType,
        filename: filename?.toString() ?? '',
        happenedAt: new Date().toISOString(),
      });
    });
    return true;
  });
  ipcMain.handle('scan:unwatchRoot', () => {
    watcher?.close();
    watcher = null;
    return true;
  });
  ipcMain.handle('files:list', (_event, query: FileListQuery) => ScanService.listFiles(query));
  ipcMain.handle('files:listIds', (_event, query: FileListQuery) => ScanService.listFileIds(query));
  ipcMain.handle('files:updateStatus', (_event, batchId: string, fileIds: string[], status: ScannedFile['status']) =>
    ScanService.updateFileStatus(batchId, fileIds, status),
  );
}
