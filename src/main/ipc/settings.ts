import { ipcMain } from 'electron';
import { SettingsService } from '../services/SettingsService';
import type { AppSettings } from '../../shared/types/app';

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', () => SettingsService.get());
  ipcMain.handle('settings:set', (_event, patch: Partial<AppSettings>) => SettingsService.set(patch));
}
