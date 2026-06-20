export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  electron: string;
  chromium: string;
  node: string;
  isPackaged: boolean;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppSettings {
  theme: ThemeMode;
  uiLanguage: 'en' | 'km';
  defaultSaveLocation: string;
  scanDepth: number;
  includeHidden: boolean;
  ignoredFolderNames: string;
  thumbnailCacheLimitMb: number;
  enableProjectLocalLog: boolean;
  defaultPreviewBehavior: 'panel' | 'modal';
  trashLocationMode: 'insideRoot' | 'custom';
  customTrashPath: string;
}

export interface ToastMessage {
  id: string;
  variant: 'info' | 'success' | 'error';
  message: string;
}

export interface CacheStats {
  fileCount: number;
  sizeBytes: number;
  limitBytes: number;
}

export interface RecentRoot {
  id: string;
  rootPath: string;
  label: string;
  lastOpenedAt: string;
}

export interface ScanSummary {
  batchId: string;
  rootPath: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  finishedAt: string | null;
  fileCount: number;
  folderCount: number;
  totalBytes: number;
  byExtension: Array<{ extension: string; count: number }>;
  byType: Array<{ fileType: string; count: number }>;
  largestFolders: Array<{ relativePath: string; fileCount: number; totalBytes: number }>;
  recentFiles: ScannedFile[];
  messyCount: number;
  warnings: string[];
  errorMessage?: string;
}

export interface ScanProgress {
  batchId: string;
  rootPath: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  currentPath: string;
  fileCount: number;
  folderCount: number;
  totalBytes: number;
  message: string;
}

export interface ScannedFile {
  id: string;
  scanBatchId: string;
  rootPath: string;
  relativePath: string;
  folderRelativePath: string;
  filename: string;
  extension: string;
  fileType: 'image' | 'pdf' | 'video' | 'document' | 'other';
  sizeBytes: number;
  modifiedAt: string;
  width: number | null;
  height: number | null;
  tags: string[];
  status: 'organized' | 'approved' | 'needs_review' | 'reference' | 'trash_candidate';
  contentHash: string | null;
  perceptualHash: string | null;
}

export interface FolderTreeItem {
  relativePath: string;
  name: string;
  depth: number;
  fileCount: number;
  totalBytes: number;
}

export interface TagSummary {
  tag: string;
  count: number;
}

export interface FileListQuery {
  batchId: string;
  limit?: number;
  offset?: number;
  search?: string;
  folder?: string;
  fileType?: ScannedFile['fileType'] | 'all';
  extension?: string;
  tag?: string;
  status?: ScannedFile['status'] | 'all';
  minSizeBytes?: number;
  maxSizeBytes?: number;
  modifiedAfter?: string;
  modifiedBefore?: string;
}

export interface FileListResult {
  files: ScannedFile[];
  total: number;
  limit: number;
  offset: number;
}

export interface DuplicateGroup {
  key: string;
  totalBytes: number;
  files: ScannedFile[];
}

export interface FilenameSuggestion {
  fileId: string;
  relativePath: string;
  currentName: string;
  suggestedName: string;
  reason: string;
}

export interface ProductCodeGroup {
  code: string;
  count: number;
  files: ScannedFile[];
}

export interface NearDuplicateGroup {
  id: string;
  distance: number;
  files: ScannedFile[];
}

export type ActionPreviewOperation =
  | { type: 'move'; targetFolder: string }
  | { type: 'trash' }
  | { type: 'normalizeExtension'; casing: 'lower' | 'upper' }
  | { type: 'isolateFormat' }
  | { type: 'productFolders' }
  | { type: 'suggestedRename'; suggestions: Array<{ fileId: string; suggestedName: string }> }
  | { type: 'sequence'; baseName: string; start: number; padding: number; separator: string }
  | {
      type: 'rename';
      prefix?: string;
      suffix?: string;
      replaceFrom?: string;
      replaceTo?: string;
      removeText?: string;
    };

export interface ActionPreviewRequest {
  batchId: string;
  rootPath: string;
  fileIds: string[];
  operation: ActionPreviewOperation;
}

export interface ActionPreviewItem {
  fileId: string;
  originalRelativePath: string;
  proposedRelativePath: string | null;
  status: 'ready' | 'conflict' | 'invalid' | 'skipped';
  message: string | null;
}

export interface ActionPreviewResult {
  previewId: string;
  createdAt: string;
  operationType: ActionPreviewOperation['type'];
  rootPath: string;
  itemCount: number;
  readyCount: number;
  conflictCount: number;
  invalidCount: number;
  skippedCount: number;
  affectedBytes: number;
  foldersToCreate: string[];
  items: ActionPreviewItem[];
}

export interface ActionPreviewHistoryItem {
  id: string;
  createdAt: string;
  operationType: ActionPreviewOperation['type'];
  rootPath: string;
  itemCount: number;
  readyCount: number;
  conflictCount: number;
  invalidCount: number;
  skippedCount: number;
  affectedBytes: number;
}

export interface ActionApplyItem {
  fileId: string;
  originalPath: string;
  targetPath: string | null;
  status: 'applied' | 'failed' | 'skipped';
  message: string | null;
}

export interface ActionApplyResult {
  operationId: string;
  previewId: string;
  createdAt: string;
  operationType: ActionPreviewOperation['type'];
  rootPath: string;
  appliedCount: number;
  failedCount: number;
  skippedCount: number;
  items: ActionApplyItem[];
}

export interface ActionOperationHistoryItem {
  id: string;
  previewId: string;
  createdAt: string;
  operationType: ActionPreviewOperation['type'];
  rootPath: string;
  appliedCount: number;
  failedCount: number;
  skippedCount: number;
  undoStatus: 'not_undone' | 'partial' | 'undone';
}

export interface ActionOperationDetailItem {
  fileId: string;
  originalPath: string;
  targetPath: string | null;
  status: ActionApplyItem['status'];
  message: string | null;
  undoStatus: ActionUndoItem['status'] | 'not_undone';
  undoMessage: string | null;
}

export interface ActionOperationDetail extends ActionOperationHistoryItem {
  items: ActionOperationDetailItem[];
}

export interface ActionUndoItem {
  fileId: string;
  originalPath: string;
  targetPath: string;
  status: 'undone' | 'failed' | 'skipped';
  message: string | null;
}

export interface ActionUndoResult {
  operationId: string;
  undoneCount: number;
  failedCount: number;
  skippedCount: number;
  items: ActionUndoItem[];
}
