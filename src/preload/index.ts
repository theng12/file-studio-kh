import { contextBridge, ipcRenderer } from 'electron';
import type { ActionApplyResult, ActionOperationDetail, ActionOperationHistoryItem, ActionPreviewHistoryItem, ActionPreviewRequest, ActionPreviewResult, ActionUndoResult, AppInfo, AppSettings, CacheStats, DuplicateGroup, FileListQuery, FileListResult, FilenameSuggestion, FolderTreeItem, NearDuplicateGroup, ProductCodeGroup, RecentRoot, ScannedFile, ScanProgress, ScanSummary, TagSummary } from '../shared/types/app';

const api = {
  app: {
    getInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:getInfo'),
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('app:openExternal', url),
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    set: (patch: Partial<AppSettings>): Promise<AppSettings> => ipcRenderer.invoke('settings:set', patch),
  },
  folders: {
    pickRoot: (): Promise<RecentRoot | null> => ipcRenderer.invoke('folders:pickRoot'),
    pickDirectory: (title?: string): Promise<string | null> => ipcRenderer.invoke('folders:pickDirectory', title),
    validate: (rootPath: string): Promise<RecentRoot> => ipcRenderer.invoke('folders:validate', rootPath),
    listRecent: (): Promise<RecentRoot[]> => ipcRenderer.invoke('folders:listRecent'),
    revealPath: (rootPath: string, relativePath?: string): Promise<void> =>
      ipcRenderer.invoke('folders:revealPath', rootPath, relativePath),
    revealItem: (rootPath: string, relativePath: string): Promise<void> =>
      ipcRenderer.invoke('folders:revealItem', rootPath, relativePath),
    openItem: (rootPath: string, relativePath: string): Promise<void> =>
      ipcRenderer.invoke('folders:openItem', rootPath, relativePath),
  },
  scan: {
    start: (rootPath: string): Promise<ScanSummary> => ipcRenderer.invoke('scan:start', rootPath),
    cancel: (batchId: string): Promise<boolean> => ipcRenderer.invoke('scan:cancel', batchId),
    getSummary: (batchId?: string): Promise<ScanSummary> => ipcRenderer.invoke('scan:getSummary', batchId),
    listFolders: (batchId: string): Promise<FolderTreeItem[]> => ipcRenderer.invoke('scan:listFolders', batchId),
    listTags: (batchId: string): Promise<TagSummary[]> => ipcRenderer.invoke('scan:listTags', batchId),
    watchRoot: (rootPath: string): Promise<boolean> => ipcRenderer.invoke('scan:watchRoot', rootPath),
    unwatchRoot: (): Promise<boolean> => ipcRenderer.invoke('scan:unwatchRoot'),
    onProgress: (callback: (progress: ScanProgress) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: ScanProgress) => callback(progress);
      ipcRenderer.on('scan:progress', listener);
      return () => ipcRenderer.off('scan:progress', listener);
    },
    onWatchEvent: (callback: (event: { rootPath: string; eventType: string; filename: string; happenedAt: string }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: { rootPath: string; eventType: string; filename: string; happenedAt: string }) => callback(payload);
      ipcRenderer.on('scan:watchEvent', listener);
      return () => ipcRenderer.off('scan:watchEvent', listener);
    },
  },
  files: {
    list: (query: FileListQuery): Promise<FileListResult> => ipcRenderer.invoke('files:list', query),
    listIds: (query: FileListQuery): Promise<string[]> => ipcRenderer.invoke('files:listIds', query),
    updateStatus: (batchId: string, fileIds: string[], status: ScannedFile['status']): Promise<number> =>
      ipcRenderer.invoke('files:updateStatus', batchId, fileIds, status),
  },
  thumbnails: {
    get: (rootPath: string, relativePath: string): Promise<string | null> =>
      ipcRenderer.invoke('thumbnails:get', rootPath, relativePath),
    getCacheStats: (): Promise<CacheStats> => ipcRenderer.invoke('thumbnails:getCacheStats'),
    clearCache: (): Promise<CacheStats> => ipcRenderer.invoke('thumbnails:clearCache'),
    enforceCacheLimit: (): Promise<CacheStats> => ipcRenderer.invoke('thumbnails:enforceCacheLimit'),
  },
  actions: {
    preview: (request: ActionPreviewRequest): Promise<ActionPreviewResult> =>
      ipcRenderer.invoke('actions:preview', request),
    listPreviews: (limit?: number): Promise<ActionPreviewHistoryItem[]> =>
      ipcRenderer.invoke('actions:listPreviews', limit),
    getPreview: (previewId: string): Promise<ActionPreviewResult> =>
      ipcRenderer.invoke('actions:getPreview', previewId),
    revalidatePreview: (previewId: string): Promise<ActionPreviewResult> =>
      ipcRenderer.invoke('actions:revalidatePreview', previewId),
    applyPreview: (previewId: string): Promise<ActionApplyResult> =>
      ipcRenderer.invoke('actions:applyPreview', previewId),
    listOperations: (limit?: number): Promise<ActionOperationHistoryItem[]> =>
      ipcRenderer.invoke('actions:listOperations', limit),
    getOperation: (operationId: string): Promise<ActionOperationDetail> =>
      ipcRenderer.invoke('actions:getOperation', operationId),
    undoOperation: (operationId: string): Promise<ActionUndoResult> =>
      ipcRenderer.invoke('actions:undoOperation', operationId),
  },
  advanced: {
    duplicateGroups: (batchId: string): Promise<DuplicateGroup[]> =>
      ipcRenderer.invoke('advanced:duplicateGroups', batchId),
    nearDuplicateGroups: (batchId: string, maxDistance?: number): Promise<NearDuplicateGroup[]> =>
      ipcRenderer.invoke('advanced:nearDuplicateGroups', batchId, maxDistance),
    filenameSuggestions: (batchId: string): Promise<FilenameSuggestion[]> =>
      ipcRenderer.invoke('advanced:filenameSuggestions', batchId),
    productCodeGroups: (batchId: string): Promise<ProductCodeGroup[]> =>
      ipcRenderer.invoke('advanced:productCodeGroups', batchId),
    exportScanCsv: (batchId: string): Promise<string | null> =>
      ipcRenderer.invoke('advanced:exportScanCsv', batchId),
    exportOperationsCsv: (): Promise<string | null> =>
      ipcRenderer.invoke('advanced:exportOperationsCsv'),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
