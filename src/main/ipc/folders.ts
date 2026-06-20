import { ipcMain } from 'electron';
import { FolderService } from '../services/FolderService';

export function registerFoldersIpc(): void {
  ipcMain.handle('folders:pickRoot', () => FolderService.pickRoot());
  ipcMain.handle('folders:pickDirectory', (_event, title?: string) => FolderService.pickDirectory(title));
  ipcMain.handle('folders:validate', (_event, rootPath: string) => FolderService.validate(rootPath));
  ipcMain.handle('folders:listRecent', () => FolderService.listRecent());
  ipcMain.handle('folders:revealPath', (_event, rootPath: string, relativePath?: string) =>
    FolderService.revealPath(rootPath, relativePath),
  );
  ipcMain.handle('folders:revealItem', (_event, rootPath: string, relativePath: string) =>
    FolderService.revealItem(rootPath, relativePath),
  );
  ipcMain.handle('folders:openItem', (_event, rootPath: string, relativePath: string) =>
    FolderService.openItem(rootPath, relativePath),
  );
}
