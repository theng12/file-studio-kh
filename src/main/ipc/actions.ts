import { ipcMain } from 'electron';
import { ActionPreviewService } from '../services/ActionPreviewService';
import { FileOperationService } from '../services/FileOperationService';
import { guardedWork } from '../services/UpdateHoldService';
import type { ActionPreviewRequest } from '../../shared/types/app';

export function registerActionsIpc(): void {
  ipcMain.handle('actions:preview', (_event, request: ActionPreviewRequest) =>
    ActionPreviewService.preview(request),
  );
  ipcMain.handle('actions:listPreviews', (_event, limit?: number) =>
    ActionPreviewService.listPreviews(limit),
  );
  ipcMain.handle('actions:getPreview', (_event, previewId: string) =>
    ActionPreviewService.getPreview(previewId),
  );
  ipcMain.handle('actions:revalidatePreview', (_event, previewId: string) =>
    ActionPreviewService.revalidatePreview(previewId),
  );
  ipcMain.handle('actions:applyPreview', (_event, previewId: string) =>
    guardedWork('apply', () => FileOperationService.applyPreview(previewId)),
  );
  ipcMain.handle('actions:listOperations', (_event, limit?: number) =>
    FileOperationService.listOperations(limit),
  );
  ipcMain.handle('actions:getOperation', (_event, operationId: string) =>
    FileOperationService.getOperation(operationId),
  );
  ipcMain.handle('actions:undoOperation', (_event, operationId: string) =>
    guardedWork('undo', () => FileOperationService.undoOperation(operationId)),
  );
}
