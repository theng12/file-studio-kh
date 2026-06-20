import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { app } from 'electron';
import type { AppSettings } from '../../shared/types/app';

let cache: AppSettings | null = null;

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json');
}

function defaults(): AppSettings {
  return {
    theme: 'light',
    uiLanguage: 'en',
    defaultSaveLocation: join(app.getPath('documents'), 'File Studio KH'),
    scanDepth: 8,
    includeHidden: false,
    ignoredFolderNames: '_trash,node_modules,.git',
    thumbnailCacheLimitMb: 1024,
    enableProjectLocalLog: false,
    defaultPreviewBehavior: 'panel',
    trashLocationMode: 'insideRoot',
    customTrashPath: '',
  };
}

function coerceSettings(value: Partial<AppSettings>): AppSettings {
  const merged = { ...defaults(), ...value };

  return {
    ...merged,
    theme: ['light', 'dark', 'system'].includes(merged.theme) ? merged.theme : 'light',
    uiLanguage: merged.uiLanguage === 'km' ? 'km' : 'en',
    scanDepth: Math.min(Math.max(Number(merged.scanDepth) || 8, 1), 20),
    includeHidden: Boolean(merged.includeHidden),
    ignoredFolderNames: typeof merged.ignoredFolderNames === 'string' ? merged.ignoredFolderNames : '_trash,node_modules,.git',
    thumbnailCacheLimitMb: Math.min(Math.max(Number(merged.thumbnailCacheLimitMb) || 1024, 128), 10240),
    enableProjectLocalLog: Boolean(merged.enableProjectLocalLog),
    defaultPreviewBehavior: merged.defaultPreviewBehavior === 'modal' ? 'modal' : 'panel',
    trashLocationMode: merged.trashLocationMode === 'custom' ? 'custom' : 'insideRoot',
    customTrashPath: typeof merged.customTrashPath === 'string' ? merged.customTrashPath : '',
  };
}

export const SettingsService = {
  get(): AppSettings {
    if (cache) return cache;

    if (!existsSync(settingsFile())) {
      cache = defaults();
      return cache;
    }

    try {
      const raw = readFileSync(settingsFile(), 'utf8');
      cache = coerceSettings(JSON.parse(raw) as Partial<AppSettings>);
      return cache;
    } catch {
      cache = defaults();
      return cache;
    }
  },

  set(patch: Partial<AppSettings>): AppSettings {
    cache = coerceSettings({ ...this.get(), ...patch });
    mkdirSync(dirname(settingsFile()), { recursive: true });
    writeFileSync(settingsFile(), JSON.stringify(cache, null, 2), 'utf8');
    return cache;
  },
};
