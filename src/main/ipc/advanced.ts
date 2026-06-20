import { ipcMain } from 'electron';
import { AdvancedService } from '../services/AdvancedService';

export function registerAdvancedIpc(): void {
  ipcMain.handle('advanced:duplicateGroups', (_event, batchId: string) => AdvancedService.duplicateGroups(batchId));
  ipcMain.handle('advanced:nearDuplicateGroups', (_event, batchId: string, maxDistance?: number) =>
    AdvancedService.nearDuplicateGroups(batchId, maxDistance),
  );
  ipcMain.handle('advanced:filenameSuggestions', (_event, batchId: string) => AdvancedService.filenameSuggestions(batchId));
  ipcMain.handle('advanced:productCodeGroups', (_event, batchId: string) => AdvancedService.productCodeGroups(batchId));
  ipcMain.handle('advanced:exportScanCsv', (_event, batchId: string) => AdvancedService.exportScanCsv(batchId));
  ipcMain.handle('advanced:exportOperationsCsv', () => AdvancedService.exportOperationsCsv());
}
