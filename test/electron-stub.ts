// Stands in for `electron` when the check suite runs under ELECTRON_RUN_AS_NODE,
// where `require('electron')` is only a path string and has no `app`, `dialog` or `shell`.
// Every path the services ask for lands in one throwaway folder.
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.env.FSKH_TEST_DIR ?? join(tmpdir(), 'file-studio-kh-test');

export const app = {
  getPath: (name: string): string => {
    if (name === 'userData') return join(root, 'userData');
    if (name === 'documents') return join(root, 'documents');
    return join(root, name);
  },
};

export const dialog = {
  showOpenDialog: async () => ({ canceled: true, filePaths: [] as string[] }),
  showSaveDialog: async () => ({ canceled: true, filePath: undefined as string | undefined }),
};

export const shell = {
  showItemInFolder: (_path: string): void => undefined,
  openPath: async (_path: string): Promise<string> => '',
};

export const ipcMain = { handle: (_channel: string, _fn: unknown): void => undefined };

export const BrowserWindow = class {};
