import { app, ipcMain, shell } from 'electron';
import type { AppInfo } from '../../shared/types/app';

const ALLOWED_EXTERNAL_HOSTS = new Set(['nowpayments.io']);

function canOpenExternal(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' && ALLOWED_EXTERNAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function openAllowedExternal(rawUrl: string): Promise<void> {
  if (!canOpenExternal(rawUrl)) {
    throw new Error('External link is not allowed.');
  }

  return shell.openExternal(rawUrl);
}

export function registerAppIpc(): void {
  ipcMain.handle('app:getInfo', (): AppInfo => ({
    name: 'File Studio KH',
    version: app.getVersion(),
    platform: process.platform,
    electron: process.versions.electron,
    chromium: process.versions.chrome,
    node: process.versions.node,
    isPackaged: app.isPackaged,
  }));

  ipcMain.handle('app:openExternal', (_event, url: string) => openAllowedExternal(url));
}
