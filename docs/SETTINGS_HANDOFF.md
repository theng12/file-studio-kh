# Settings — Handoff Spec

> _Last revised: 2026-05-19. Reference implementation: Label Studio KH v0.5.2._
> _For global conventions see `AGENTS.md` in this folder. If anything below contradicts AGENTS.md, AGENTS.md wins._

A self-contained spec for the **universal** settings page in a desktop app. Hand this file to a fresh Claude Code session in a new project and it will reproduce the page at ~1:1 parity for the four rows every app needs, plus an About card with version + update check.

This doc deliberately **excludes app-specific settings** (e.g. "default DPI", "snap grid mm", "default filename pattern"). Add those per-app — they don't belong in a shared spec.

The receiving Claude does **not** need access to the original codebase. Schema, layout, IPC contract, and the genuinely tricky bits (cross-language coercion, OS-folder-reveal) are inlined.

---

## 1. Goal

Every desktop app should ship a Settings page with at least these rows:

1. **Theme** — Light / Dark / System (default **Light**)
2. **Language** — only the languages you actually maintain
3. **Save location** — current path shown as a clickable folder + a _Reveal_ button + a _Change…_ picker
4. **About** — app name + version + platform info + a _Check for updates_ button

Each row is consistent across apps so users can find the same controls in the same place. Per-app rows go above or below this universal block.

---

## 2. Storage layout

A single `<userData>/settings.json` file with a flat shape. The main process owns it; the renderer reads/writes via IPC.

```ts
// main/services/SettingsService.ts

interface AppSettings {
  // Universal fields (every app)
  uiLanguage: string;          // 'en' | 'km' | … — must be in SUPPORTED_LANGUAGES
  defaultSaveLocation: string; // absolute path

  // Per-app fields go below this line — examples:
  // defaultDpi: 150 | 300 | 600;
  // defaultNamingPattern: string;
  // …
}

let cache: AppSettings | null = null;

function file(): string {
  return join(app.getPath('userData'), 'settings.json');
}

function defaults(): AppSettings {
  return {
    uiLanguage: 'en',
    defaultSaveLocation: join(app.getPath('documents'), '<App Name>'),
    // …app-specific defaults
  };
}

export const SettingsService = {
  get(): AppSettings {
    if (cache) return cache;
    if (!existsSync(file())) { cache = defaults(); return cache; }
    try {
      const raw = readFileSync(file(), 'utf8');
      cache = { ...defaults(), ...(JSON.parse(raw) as Partial<AppSettings>) };
      return cache;
    } catch {
      cache = defaults();
      return cache;
    }
  },
  set(patch: Partial<AppSettings>): AppSettings {
    cache = { ...this.get(), ...patch };
    writeFileSync(file(), JSON.stringify(cache, null, 2), 'utf8');
    return cache;
  },
};
```

**Why flat JSON, not SQLite:** the set is small (~10 fields), the file is human-readable for debugging, and the full-file rewrite cost is negligible. Don't reach for a database here.

**`{ …defaults(), …saved }` merge** matters: when you add a new setting in a future release, existing users' settings.json doesn't have that key. The merge plugs in the default so the renderer never sees `undefined` for a known setting.

---

## 3. IPC + preload

Two channels, both on the main process:

```ts
// main/ipc/settings.ts
ipcMain.handle('settings:get', () => SettingsService.get());
ipcMain.handle('settings:set', (_e, patch: Partial<AppSettings>) =>
  SettingsService.set(patch),
);
```

Preload:

```ts
settings: {
  get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  set: (patch: Record<string, unknown>): Promise<unknown> =>
    ipcRenderer.invoke('settings:set', patch),
},
```

The renderer just calls `await window.api.settings.get()` once on mount and `await window.api.settings.set({ key: value })` on each change. No store needed — local React state mirroring the returned object is enough.

---

## 4. Theme row

Default to **Light** on first launch. Never silently follow OS dark mode for a freshly installed app — users haven't expressed a preference yet, and surprise dark mode looks like a bug.

```ts
// renderer/stores/themeStore.ts
export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = '<app>.theme';   // namespace per app
const DEFAULT_MODE: ThemeMode = 'light';

function applyTheme(resolved: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

function resolve(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: DEFAULT_MODE,
  resolved: 'light',
  setMode: (mode) => {
    const resolved = resolve(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    applyTheme(resolved);
    set({ mode, resolved });
  },
  init: () => {
    const stored =
      (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? DEFAULT_MODE;
    const resolved = resolve(stored);
    applyTheme(resolved);
    set({ mode: stored, resolved });

    // Track OS pref live for users on 'system'.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => {
      if (get().mode === 'system') {
        const r = mq.matches ? 'dark' : 'light';
        applyTheme(r);
        set({ resolved: r });
      }
    });
  },
}));
```

Call `useThemeStore.getState().init()` once at app boot (in your top-level `App.tsx` `useEffect`).

**UI control** — a three-button segmented switch, not a dropdown:

```
[ Light ]  [ Dark ]  [ System ]
```

Active button has accent fill. Tooltip on each. Picking a value calls `themeStore.setMode(value)` — store handles localStorage + DOM class.

---

## 5. Language row

**Only ship the languages you actually maintain.** A locale stub that hasn't been updated in three releases is worse than English-only — users get half-translated UI and weird mixing.

The reference app shipped 6 locale files and trimmed to 2 (English + Khmer) once it became obvious the other four were placeholder JSON.

```ts
// renderer/i18n.ts
import en from '../../locales/en.json';
import km from '../../locales/km.json';

const STORAGE_KEY = '<app>.lang';

const resources = {
  en: { translation: en },
  km: { translation: km },
};

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'km', label: 'ខ្មែរ (Khmer)' },
] as const;

const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code) as readonly string[];

// Coerce an out-of-set persisted value back to 'en'. Critical when
// you trim languages: a user who had 'th' picked yesterday shouldn't
// see broken UI today.
const stored = localStorage.getItem(STORAGE_KEY) ?? 'en';
const initialLng = SUPPORTED_CODES.includes(stored) ? stored : 'en';

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLng,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// Persist the coerced value so localStorage stays valid.
if (stored !== initialLng) localStorage.setItem(STORAGE_KEY, initialLng);

export function setLanguage(lang: string): void {
  const next = SUPPORTED_CODES.includes(lang) ? lang : 'en';
  localStorage.setItem(STORAGE_KEY, next);
  void i18n.changeLanguage(next);
}
```

**UI control** — a `<select>` listing `SUPPORTED_LANGUAGES`. On change:

```ts
onChange={(e) => {
  setLanguage(e.target.value);
  void update({ uiLanguage: e.target.value });
}}
```

Two writes: `i18n` for the live UI swap + `settings.json` for the persistent value. They're tracked separately because `i18n` operates in localStorage and settings.json mirrors the choice for main-process consumers.

---

## 6. Save location row

Three controls on one row:

```
┌─────────────────────────────────────────────────────────┐
│ Save location                                            │
│ Where exports and generated files land by default.       │
│                                                          │
│   [/Users/me/Documents/MyApp]   [📂 Reveal] [Change…]   │
└─────────────────────────────────────────────────────────┘
```

- **The path itself is clickable** — clicking it opens the folder in Finder (or Explorer / Files on Win/Linux). This is the discoverability win — most users don't expect a path display to be interactive, but those who try it find it useful.
- **Reveal** ghost button — same action, for users who didn't realise the path was clickable. Belt + braces.
- **Change…** secondary button — opens the OS folder picker, returns a new absolute path, persists to settings.

```tsx
const onPickFolder = async () => {
  const folder = await window.api.export.pickFolder(s?.defaultSaveLocation);
  if (folder) await update({ defaultSaveLocation: folder });
};

const onRevealFolder = async () => {
  if (!s?.defaultSaveLocation) return;
  await window.api.export.revealInFinder(s.defaultSaveLocation);
};
```

**Required IPC** (shared with your export pipeline; if you don't have one yet, add these in `main/ipc/dialog.ts`):

```ts
ipcMain.handle('export:pickFolder', async (_e, defaultPath?: string) => {
  const result = await dialog.showOpenDialog({
    title: 'Select output folder',
    defaultPath,
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0]!;
});

ipcMain.handle('export:revealInFinder', async (_e, filePath: string) => {
  shell.showItemInFolder(filePath);
});
```

`shell.showItemInFolder` works on a folder path the same way as on a file: it opens the parent with the target selected. For a folder, the OS just opens the folder. Cross-platform on macOS / Windows / Linux.

---

## 7. About card

A bordered card at the bottom of the Settings page (visually distinct from the rows above). Three blocks:

1. **Identity** — app name + tagline + version on the right (with a `development build` chip when running unpacked).
2. **Platform details** — four key/value pairs in a 2-column grid: Platform, Electron, Chromium, Node.
3. **Update check** — one secondary button + a one-line status string.

```tsx
function About({ info }: { info: AppInfo | null }) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const onCheck = async () => {
    setChecking(true);
    setResult(null);
    try {
      const r = await window.api.updater.checkNow();
      if (!r.ok) {
        setResult(
          r.reason === 'dev-build'
            ? 'Update check is only available in packaged builds.'
            : `Couldn't check: ${r.reason ?? 'unknown error'}`,
        );
      } else if (r.version && info?.version && r.version !== info.version) {
        setResult(
          `v${r.version} is available. It will download in the background; you'll see a Restart prompt when it's ready.`,
        );
      } else {
        setResult("You're on the latest version.");
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="mt-8 rounded-lg border border-border-base bg-bg-surface p-5">
      {/* identity block + platform grid + check-for-updates row */}
    </div>
  );
}
```

**Required IPC** on the main process:

```ts
ipcMain.handle('app:getInfo', () => ({
  name: app.getName(),
  version: app.getVersion(),
  electronVersion: process.versions.electron,
  nodeVersion: process.versions.node,
  chromeVersion: process.versions.chrome,
  platform: process.platform,
  isDev: !app.isPackaged,
}));

ipcMain.handle('updater:checkNow', async () => {
  if (!app.isPackaged) return { ok: false, reason: 'dev-build' };
  try {
    const r = await autoUpdater.checkForUpdates();   // electron-updater
    return { ok: true, version: r?.updateInfo?.version ?? null };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
});
```

**Disable the button when `isDev`** — auto-update only fires on packaged builds; the dev case would always show a confusing error.

---

## 8. Page layout

```
Settings
─────────────────────────────────────────────────────────
Theme               Light / Dark / System (default Light)
                    [ Light ] [ Dark ] [ System ]
─────────────────────────────────────────────────────────
Language            English + Khmer
                    [ English  ▾ ]
─────────────────────────────────────────────────────────
Save location       Where exports land by default
                    [/Users/me/Documents/Foo] [📂 Reveal] [Change…]
─────────────────────────────────────────────────────────
… app-specific rows go here …
─────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────┐
│  ABOUT                                                   │
│  My App                                       v0.5.2     │
│  Tagline                                                 │
│  ────────────────────────────────────────────────        │
│  Platform   darwin       Electron  33.4.11               │
│  Chromium   130.0.6723.x Node      20.x                  │
│  ────────────────────────────────────────────────        │
│  When a new build is available it downloads in the       │
│  background and prompts to restart.                      │
│                                  [ Check for updates ]   │
└─────────────────────────────────────────────────────────┘
```

Each row uses a shared `<Row>` component for consistency:

```tsx
function Row({ label, description, children }: {
  label: string; description: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border-subtle py-4">
      <div>
        <div className="text-sm font-medium text-fg-base">{label}</div>
        <div className="mt-0.5 text-xs text-fg-muted">{description}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}
```

---

## 9. i18n keys for the rows

If you're using i18next, here's the universal key set. Drop these into every locale JSON. Per-app rows define their own labels.

```json
{
  "settings": {
    "title": "Settings",
    "theme": "Theme",
    "themeDescription": "Light, dark, or follow your system.",
    "language": "Language",
    "languageDescription": "Used for the interface and date formatting.",
    "saveLocation": "Save location",
    "saveLocationDescription": "Where exports and generated files land by default."
  }
}
```

---

## 10. What NOT to do

- ❌ **Don't default theme to 'system'.** Pick Light by default. Users on a dark-mode Mac haven't asked for a dark app yet — let them opt in.
- ❌ **Don't ship languages you don't maintain.** A half-translated UI is worse than English-only. The reference shipped 6, trimmed to 2; do the trim early.
- ❌ **Don't show the save location as plain text.** Make it clickable — the discoverability win is real.
- ❌ **Don't put _Check for updates_ at the top of the page.** It's an About-block action; keep it there. Day-to-day use never touches it.
- ❌ **Don't bundle settings.json with the app installer.** It's user-data; let it be created on first run with `defaults()`. Bundling means a reinstall could clobber a user's preferences.
- ❌ **Don't enable the update button in dev builds.** It always errors; surface that pre-emptively in the disabled tooltip.
- ❌ **Don't write to localStorage for `defaultSaveLocation`.** Renderer-only state can't be read by main-process IPC handlers that need it (e.g. for export defaults). Always round-trip through `settings.json`.
- ❌ **Don't store secret keys in settings.json.** It's user-readable plain JSON. Use `.env` + `EnvLoader` on the main process for API keys.

---

## 11. Files involved (Electron + React + Tailwind reference stack)

```
src/main/services/SettingsService.ts   # JSON read/write + cache + defaults
src/main/ipc/settings.ts               # settings:get / settings:set
src/main/ipc/app.ts                    # app:getInfo
src/main/ipc/updater.ts                # updater:checkNow (uses electron-updater)
src/preload/index.ts                   # settings.* + app.* + updater.* surfaces
src/renderer/stores/themeStore.ts      # Zustand: mode, resolved, init, setMode
src/renderer/i18n.ts                   # i18next + SUPPORTED_LANGUAGES + setLanguage
src/renderer/pages/Settings.tsx        # the page itself
locales/<code>.json                    # one per supported language
```

---

## 12. Acceptance checklist

After implementation:

- [ ] Fresh install lands in Light mode regardless of OS dark-mode setting.
- [ ] Picking Dark in the segmented switch persists across restarts.
- [ ] Picking System reflects the OS pref live (toggle macOS dark mode → UI follows).
- [ ] Language dropdown shows only languages you have a real JSON file for.
- [ ] A previously-stored locale that's no longer in the list (e.g. removed `th.json`) coerces back to `en` silently on next launch.
- [ ] Save location path is clickable — click opens the folder in Finder.
- [ ] _Reveal_ ghost button does the same thing as clicking the path.
- [ ] _Change…_ opens the OS folder picker and persists the new path immediately.
- [ ] About card shows real `app.getVersion()` (not hard-coded), platform info from `process.versions`, and a `development build` chip when running unpacked.
- [ ] _Check for updates_ disabled in dev with a tooltip explaining why.
- [ ] _Check for updates_ in a packaged build reports either "You're on the latest version." or a "vX is available" line.

---

## 13. Cross-references

- **DONATIONS_HANDOFF.md** — covers the _Support this app_ entry. Sits in the sidebar footer, not the Settings page.
- **BRAND_HANDOFF.md** — covers the Brand entity. Brand-level config (color, logo) belongs on the brand record, not on Settings.
- **AGENTS.md §3** — versioning + What's New conventions; the _Check for updates_ flow assumes electron-updater + a GitHub Releases publish.

---

## 14. Future extensions (out of scope for v1)

- **Keyboard shortcuts editor** — for power-user apps. Don't bother until you have ≥3 customizable shortcuts.
- **Reset to defaults button** — a `⚠️ Reset all settings` row at the bottom of the page. Add when users start asking how to "start fresh."
- **Per-row search / filter** — useful once you have more than ~15 rows. Below that it's overkill.
- **Import / export settings.json** — handy for support; one click to dump current settings into a tarball alongside the crash log. Wire into your existing crash-log flow.
