# App Building Preferences — Theng

These are durable conventions for any desktop or web app you build with me. Apply them by default; don't ask. Only deviate when I explicitly say so.

This file is intentionally short and rule-shaped, not aspirational. Treat each section as a contract.

---

## 1. Navigation — left sidebar, never top tabs

- Use a vertical sidebar on the left (~220px wide) for the primary navigation.
- Group items into labeled sections (e.g. `SETUP`, `PRODUCTION`, `SYSTEM`). Section labels in small uppercase tracked-out text.
- App name + a small logo mark at the top of the sidebar.
- Active item: light-grey fill, bold/darker text, darker-tinted icon. Inactive: subdued text, lighter icon.
- Use **inline SVG icons** (stroke-based, ~18px). Do not add an icon library as a dependency.
- The top of the main content area shows the current page title + the active context chip (e.g. active company / workspace / project). It does **not** repeat the nav.

Top-tab navigation across feature areas is forbidden. Sub-tabs *inside* a single page are acceptable but rare.

## 2. Modals / dialogs — always dismissible

- All modal popups must close when:
  - User presses **Esc**
  - User **clicks the dim backdrop** outside the modal box
- The X button in the corner must have `aria-label="Close (Esc)"` and a tooltip.
- Implement modal behavior **once** in a shared `Modal` component. Never duplicate the close logic per modal.
- Allow opt-out via `closeOnBackdrop={false}` only for destructive confirmations (rare).
- Modals must be keyboard-accessible: focus should be inside the modal when open.

## 3. Versioning + "What's new" — always present

- The app version (sourced from `package.json` via `app.getVersion()` over IPC) must be visible somewhere persistent — usually the sidebar footer.
- Provide a **"What's new"** entry in the sidebar footer (sparkles icon is fine) that opens a modal.
- **Single source of truth: the repo's `CHANGELOG.md`**. Don't maintain a separate in-code array — they always drift.
- The modal imports `CHANGELOG.md?raw` at build time (Vite's `?raw` suffix inlines the file's text into the renderer bundle) and parses it on the fly. Keep-a-Changelog format works well: `## [X.Y.Z] — DATE` for versions, `### Section` for groups, `- bullet` for items.
- Two open paths in the modal:
  - **Auto-open on launch** after an update — show only entries newer than the last-seen version (stored in `localStorage`). Closing the modal bumps the last-seen value to current.
  - **Manual open** via the sidebar footer link — show the FULL history regardless of last-seen, so users can scroll back any time. _This is the reflex that was broken in the initial implementation — fix it._
- Update CHANGELOG.md on every meaningful change (see §20 for the release-cadence rule).

## 4. Support / donate — always present

- A **"Support this app"** button in the sidebar footer (heart icon).
- Follow `DONATIONS_HANDOFF.md` for the full implementation: route to a quiet `/support` page, keep the dashboard nudge dismissible, and never gate functionality behind donations.
- Donation/payment links open in the user's default browser through Electron's `shell.openExternal` path. Never embed payment widgets in an Electron webview.
- Only allow explicit `http(s)` donation URLs. Never let arbitrary renderer-provided URLs through.

## 5. Settings — always accessible

- "Settings" is always reachable, even when no business/company/workspace is selected.
- Houses: data folder location, app preferences, reset-to-default actions, and other global config.
- Mark it `alwaysAvailable` in nav config so the "select a workspace first" gate doesn't block it.

## 6. Save semantics — two distinct patterns

Different surfaces in the app use different save patterns. Pick deliberately, not by accident.

### Auto-save (settings + standalone field edits)

For pages like Settings, where each row is independent:

- No "Save" button. Every field change is persisted via IPC immediately.
- Near the editor header (when a status indicator makes sense), show:
  - `● All changes saved` in green when idle
  - `Saving…` in amber while a save is in-flight
  - A relative timestamp (`2 min ago`) that auto-refreshes every 30s
- Errors surface via toast, not silently.

### Explicit Save (entity create / edit modals)

For modals that wrap a related cluster of fields — Brand, Product, Company, Template-level metadata:

- Explicit **Cancel** + **Create** / **Save changes** in the modal footer.
- _Why deviate from auto-save here:_ users often try a color, type a name, tweak a logo, then change their mind. Try-then-commit semantics make that workflow forgiving. Auto-saving every keystroke during entity creation would also pollute the database with empty-named drafts.
- Save button is disabled while the form is invalid (e.g. blank required field) or in-flight (`Saving…`).
- Cancel closes without persisting; Esc / backdrop-click do the same (per §2).
- Errors surface inside the modal, not via toast — the user is looking at the form when it happens.

When in doubt about which pattern to use: **per-field standalone control → auto-save**; **multi-field record being created or edited as a unit → explicit Save**.

## 7. Toasts

- Single-line, bottom-center, auto-dismiss after 3s.
- Variants: `info` (slate), `success` (emerald), `error` (rose).
- Use them for "Saved", "Imported N rows", "Exported to <path>", and actual error messages.
- Never use them for blocking content — that's what modals are for.

## 8. Data folder is user-configurable

For desktop apps:

- Default location: `app.getPath('userData')/data/`.
- Settings UI lets the user pick a different folder (Documents, Dropbox, external drive, etc.).
- Persist the choice in `config.json` under userData (not the DB — chicken/egg).
- "Move existing data" checkbox when switching, default ON.
- Trigger an Electron `app.relaunch() + app.exit()` after switching so the new DB connection opens cleanly. Prompt the user before restarting.

## 9. Asset storage — content-addressed, deduplicated

- For catalogue/entity apps where the user imports files into the app's own records, copied asset storage is the default: user-imported files (images, logos, icons) are **copied** into the app's data folder under `assets/`. Never reference absolute paths from the user's disk in the database.
- Filename pattern: `<slug>-<hash10>.<ext>` where `hash10` is the first 10 hex chars of the source file's SHA-1.
- Identical content → identical hash → identical filename → automatic dedup. No two copies on disk.
- Renderer accesses these via a custom protocol (e.g. `app-image://local/<relpath>`). Resolve in main process; serve via `protocol.handle()` (not the deprecated `registerFileProtocol`). Pick the scheme name per app and keep it consistent inside that app.
- Auto-import-on-pick: when a user picks a file in a form, copy it to assets immediately. Form state stores the *relative* path returned by the importer, not the absolute pick path. **Exception:** for entity-create modals (Brand, Product) where the user might cancel, _stage_ the absolute path locally and only import on save — otherwise you litter the asset folder with files from canceled forms. See `BRAND_HANDOFF §6` for the pattern.

### File-management app exception

Apps whose purpose is to organize existing folders, such as File Studio KH, must manage selected user files **in place**. Do not copy the selected folder's contents into app-owned `assets/` as part of normal scanning, browsing, moving, renaming, trashing, or undo. App data may hold metadata, scan caches, thumbnails, recent folders, logs, and undo state, but the user's files remain where the user chose them until a confirmed operation moves or renames them.

### Two valid asset-layout patterns

Different feature areas use different sub-paths under `assets/`. Pick deliberately:

- **`assets/<kind>/` — flat, by kind.** Use when there are many entities that each own a few files, and `<kind>` is a stable bucket (e.g. `assets/products/` for product images). Content-addressed filenames mean dedup works _across_ entities (two products sharing a stock photo = one file on disk). Used by Product Library.
- **`assets/<entityId>/` — per-record folder.** Use when the entity is "precious" (few records, each owns a tightly-scoped set of files), and you want `rm -rf assets/<id>/` to be the complete cleanup on delete. Used by Brand and Company.

Both are valid; mixing them in one app is fine. The receiving Claude should match an existing app's convention when extending it, and ask the user if starting fresh.

## 10. Pagination on long lists

- Any table or grid that can grow past ~50 items gets pagination.
- Footer shows: `Showing X–Y of Z`, prev/next buttons, page size dropdown (default 50; options 25/50/100/200), page indicator.
- Reset to page 1 when filters, search, or page size change.
- Clamp page index when the underlying list shrinks below the current page.

## 11. Excel / CSV import with column mapping

- Imports are 3 steps: **pick file → map columns → review results**.
- Auto-guess each column's target based on header text (case-insensitive, fuzzy matches like `ean`/`upc` → `barcode`).
- Show 1 sample value per column in the mapping table so users can verify.
- Imports are **upserts by natural key** (e.g. SKU). For existing rows, **only update fields that have a value in the imported row** — never blank out fields just because the column wasn't supplied. Merge JSON object fields (prices, custom fields) into existing rather than replacing.
- Provide a **"Download sample"** button that emits a workbook pre-configured with this org's price groups, custom fields, and the full canonical column set. Include an "Instructions" sheet with one row per column explaining what it accepts.

## 12. Multi-image handling

When products / entities can have multiple images:

- Store images as an ordered array. Position 0 = main.
- Provide UI to:
  - **Set as main** (move to position 0)
  - **Reorder** (← and → arrows on hover, or drag-to-reorder)
  - **Remove** (X in corner)
- Display current count vs cap (e.g. `3 / 20`).
- Hard cap per entity (default: 20) enforced server-side in IPC.
- Support **clipboard paste** (`⌘V` / `Ctrl+V`): listen for paste events with image MIME types, send `ArrayBuffer` over IPC, write to temp file, run through normal import pipeline.

## 13. Smart filename matching for batch image import

When auto-matching a folder of images to records by some key (e.g. SKU):

- **Recursive folder scan**, up to 5 levels deep. Skip dotfiles/hidden folders.
- **Case-insensitive** filename + folder name matching.
- Supported patterns for one key with N images:
  - `<key>.ext` → position 0 (main)
  - `<key>-1.ext`, `<key>-2.ext`, `<key>-3.ext` → positions in that order
  - `<key>_2.ext`, `<key> 2.ext` — same intent, different separators all accepted
  - `<key>/main.ext` or `<key>/primary.ext` or `<key>/cover.ext` → position 0
  - `<key>/1.ext`, `<key>/2.ext` → positions by number
  - `<key>/anything.ext` → falls back to alphabetical
- **Surface the matching rules** to the user before they pick a folder (a rules list in the modal). After matching, show stats: scanned, matched, imported, duplicates skipped, unmatched, cap-skipped.

## 14. Database conventions (SQLite + better-sqlite3)

- Column names: `snake_case`. JS object keys: `camelCase`. Convert via `rowToX(row)` mapper functions per table.
- Foreign keys with `ON DELETE CASCADE` for "parent owns children" relationships (e.g. `products` are owned by a company).
- Indexes on every foreign key + every column commonly filtered.
- `UNIQUE (parent_id, natural_key)` for natural-key uniqueness scoped within parents (e.g. `UNIQUE (company_id, sku)`).
- Migrations are **additive** by default (`ALTER TABLE ADD COLUMN`). Bump `schema_version` only when you need structural changes; bumping wipes existing pre-release data.
- Use an `app_state` table for kv storage (active selection IDs, schema version, etc.).
- Use a `addColumnIfMissing(db, table, col, type)` helper that checks `PRAGMA table_info` — keep migrations idempotent.

### Delete semantics — soft vs hard

- **Hard-delete** when the natural key is stable enough that re-imports can recreate the row (e.g. Products coming from a CSV — re-importing the same SKU recreates it). The delete confirmation should warn about the re-import case so users don't conclude "delete is broken."
- **Soft-delete + boot-purge** for "precious" entities where in-session undo is worth the extra column. Pattern: a `deleted_at` (or `deletedAt`) ISO timestamp; `list()` filters them out; a `restore(id)` action clears the timestamp; a `purgeDeleted()` function called once at app start hard-deletes anything still tombstoned. Used for Brand and Company in the reference implementation.
- Don't mix the two on one table. Pick per-entity at design time.

## 15. IPC conventions (Electron)

- Channel names: `domain:action`. Examples: `products:list`, `images:setMainImage`, `app:relaunch`.
- All renderer→main calls go through preload's `window.api.<domain>.<method>(...)`. Renderer never imports Node modules directly.
- Preload exposes a single `api` object via `contextBridge.exposeInMainWorld`. Keep `nodeIntegration: false`, `contextIsolation: true`.
- Handlers `throw new Error('…')` on failure. Catch in renderer with try/catch; surface via toast.
- For binary data (clipboard images, etc.), pass `ArrayBuffer` via the structured-clone IPC.

## 16. Stack defaults (apply unless told otherwise)

| Layer | Choice |
|---|---|
| Desktop shell | Electron + `vite-plugin-electron/simple` |
| UI framework | React 18 + Vite |
| Styling | Tailwind CSS |
| State | Zustand (one store, action methods) |
| Local DB | better-sqlite3 |
| Excel/CSV | SheetJS (`xlsx`) |
| Images | `sharp` |
| PDF | Puppeteer |
| Icons | Inline SVG, no library |

Source code in **TypeScript** (`.tsx` / `.ts`) by default. Drop to plain JavaScript (`.jsx` / `.js`) only when I explicitly ask, or when the receiving project is JS-only and adding TS would be more friction than it's worth.

## 17. File layout (Electron apps)

```
src/
  main/                      # main process (TypeScript)
    index.ts                 # app entry, BrowserWindow, lifecycle logging
    services/                # one file per domain
      Database.ts            # schema, migrations, queries
      <Entity>Service.ts     # one per entity (BrandService, ProductService, …)
      paths.ts               # userData / asset / config paths
      EnvLoader.ts           # .env reader (when needed)
      Updater.ts             # electron-updater glue (when packaged)
    ipc/                     # one file per domain — `<domain>.ts`
      app.ts                 # app:getInfo, app:getAssetsDir
      brand.ts               # brand:list / brand:create / …
      <domain>.ts            # …per feature
  preload/
    index.ts                 # one contextBridge surface for the whole app
  renderer/                  # React + Vite (TypeScript)
    App.tsx
    index.css
    i18n.ts                  # if multi-lingual
    stores/                  # Zustand stores, one per domain
      brandStore.ts
      companyStore.ts
      themeStore.ts
      …
    pages/                   # one folder OR one file per route
      Dashboard.tsx
      Brands.tsx
      Products.tsx
      Settings.tsx
      …
    components/              # shared UI primitives
      Page.tsx               # the page shell (title, subtitle, actions)
      Modal.tsx              # the shared modal shell (Esc + backdrop, see §2)
      Button.tsx
      FormField.tsx
      Toast.tsx
      ConfirmDialog.tsx
      Sidebar.tsx
      WhatsNew.tsx
    hooks/                   # cross-cutting React hooks
  shared/                    # types shared between main + preload + renderer
    types/
      brand.ts
      product.ts
      …
resources/                   # bundled binary assets (fonts, icons, etc.)
locales/                     # i18n JSON files, one per supported lang
```

Notes:

- **`src/shared/types/`** holds the data-model TypeScript interfaces. Imported from main, preload, and renderer via the same alias (`@shared/types/<file>`). No runtime values here, just types.
- **Per-domain services** in `src/main/services/<Entity>Service.ts`. Each service exports a frozen object with action methods (`list`, `get`, `create`, `update`, `remove`). DB lives in `Database.ts`, services consume it.
- **Per-domain IPC** in `src/main/ipc/<domain>.ts`. Each file exports `register<Domain>Ipc()` and main's `index.ts` calls all of them at boot.
- `assets/` and `data/` (the runtime user-data folder) are NOT in the repo — they're created at runtime under `app.getPath('userData')`. Only bundled fonts / static assets go in `resources/`.

## 18. Tone & copy

- Plain English. No marketing speak. No emoji in UI text unless I ask.
- Form field hints sit under the input, ≤1 line, in muted small text.
- Error toasts contain the *actual* error message, not "Something went wrong".
- Empty states are short, kind, and offer an action ("No catalogs yet. Create your first one.").

## 19. Crash logging

Every Electron app must:

- Append lifecycle events (`boot`, `app:ready`, `before-quit`, `render-process-gone`, `child-process-gone`, `uncaughtException`, `unhandledRejection`) to `<userData>/crash.log`.
- Mirror those events to stdout too so they're visible in `npm run dev`.
- Set `ELECTRON_ENABLE_LOGGING=1` in the dev script so Chromium logs are not swallowed.

## 20. Release cadence — bump and rebuild on every change

After every bug fix or feature change that lands in the renderer or main process:

- **Bump the version** in `package.json`. Patch (`0.4.0 → 0.4.1`) for bug fixes and small UX additions; minor (`0.4.0 → 0.5.0`) for substantial features or anything user-visible enough to warrant a header in the changelog modal.
- **Add a CHANGELOG entry** for the new version with the date and a short description of what changed. The "What's new" modal parses this file directly — bumping without a matching entry leaves users staring at an empty changelog.
- **Rebuild the DMG.** Default to `npm run build:mac:arm64` (arm64-only) for local test builds; use the full `npm run build:mac` (both archs) only when explicitly asked or when publishing via `npm run release`.

The point is one-to-one correspondence between "a change shipped" and "a tested DMG with a unique version on disk." Avoid carrying multiple fixes under the same version — it gets impossible to tell which DMG has which fix during testing.

Exceptions: documentation-only changes (`AGENTS.md`, `CLAUDE.md`, README, files under `_Core Docs/`) don't need a bump. Test-build iterations during a single feature can stay on one version if the user is actively iterating with you and hasn't taken the DMG away to test on another machine yet.

## 21. Updating this file

When something new becomes a durable preference, **edit this file** in-place. Don't create a separate decisions doc; this is the single source of truth.

If a rule here is wrong or out of date, propose the correction in chat — don't silently violate it.

## 22. Cross-tool handoff

For projects that may move between Codex, Claude Code, or new sessions:

- Keep `docs/PROJECT_STATE.md` as the current architecture / behavior / known-gaps snapshot.
- Keep `docs/HANDOFF.md` as the start/end checklist.
- At the start of a session, read `AGENTS.md`, `docs/HANDOFF.md`, and `docs/PROJECT_STATE.md` before making assumptions.
- At the end of a session, update `docs/PROJECT_STATE.md` if anything meaningful changed.
- Chat history is not durable. If a decision matters later, write it to code, `AGENTS.md`, `CLAUDE.md`, or `docs/PROJECT_STATE.md`.

## 23. Git checkpoint prompt

After every successful update, bug fix, or meaningful code/doc change:

- Run the relevant verification first (usually `npm run build`; use dev/manual testing when appropriate).
- Check `git status --short`.
- Ask: **"Commit and push this checkpoint?"**
- Do not commit or push without confirmation.
- If confirmed, commit with a clear message and push to the tracked remote.
- If the user declines, leave the working tree as-is and mention that changes are uncommitted.
