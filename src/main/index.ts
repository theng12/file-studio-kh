import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { logLifecycle } from './services/log';
import { openAllowedExternal, registerAppIpc } from './ipc/app';
import { registerSettingsIpc } from './ipc/settings';
import { registerFoldersIpc } from './ipc/folders';
import { registerScanIpc } from './ipc/scan';
import { registerThumbnailIpc } from './ipc/thumbnails';
import { registerActionsIpc } from './ipc/actions';
import { registerAdvancedIpc } from './ipc/advanced';

process.env.ELECTRON_ENABLE_LOGGING = '1';

logLifecycle('boot');

process.on('uncaughtException', (error) => logLifecycle('uncaughtException', error));
process.on('unhandledRejection', (reason) => logLifecycle('unhandledRejection', reason));

let mainWindow: BrowserWindow | null = null;

function projectRoot(): string {
  const appPath = app.getAppPath();
  return appPath.endsWith('dist-electron') ? join(appPath, '..') : appPath;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    title: 'File Studio KH',
    backgroundColor: '#f5f6f7',
    webPreferences: {
      preload: join(projectRoot(), 'dist-electron/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  registerAppIpc();
  registerSettingsIpc();
  registerFoldersIpc();
  registerScanIpc();
  registerThumbnailIpc();
  registerActionsIpc();
  registerAdvancedIpc();

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void openAllowedExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logLifecycle('render-process-gone', details);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(join(projectRoot(), 'dist/index.html'));
  }
}

app.on('ready', () => {
  logLifecycle('app:ready');
  createWindow();
});

app.on('before-quit', () => logLifecycle('before-quit'));

app.on('child-process-gone', (_event, details) => logLifecycle('child-process-gone', details));

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
