# File Studio KH — agent guide

A KH macOS desktop app (Electron + React + TypeScript) that scans one folder, previews
bulk file actions as a dry run, and applies only the rows a person confirms. It moves
and renames; it never deletes, and it never copies your folder into app storage.

## Rules that apply here

- Follow `/Users/you/Developer/_orchestra/developer-handoff/LEAD-RULES.md` and the owner's
  global instructions. They win over this file.
- First call of a session: the `ponytail` skill. `impeccable` before UI work. `headroom` before a
  log or file over ~500 lines. Graphify before hand-searching when a graph exists.
- Never bring an app to the front, never drive the pointer or keyboard, never leave a window for
  the owner to close. Tests run headless (`packaging/gate.sh`).
- Commit as `112568204+theng12@users.noreply.github.com`.
- Nothing is deleted in place: retire to `~/Desktop/_trash/file-studio-kh/`.
- Native `confirm`, `alert` and `prompt` are silent no-ops in a packaged webview. Every dialog is
  the in-app `Modal` component.

## Verify before claiming done

```sh
npm run build          # typecheck + both bundles
npm test               # headless check suite in a throwaway folder
packaging/gate.sh      # rules scan, checks, hidden boot, version agreement
packaging/build-dmg.sh # DMG into dist/
```

## Invariants

- **Soft delete only.** A trash operation moves the file into `_trash` (inside the selected
  folder, or the custom base folder). Never `unlink`, `rm -r` or `fs.rm` a user file. The only
  deletions allowed are the thumbnail cache under the app's own data folder.
- **Nothing is applied that was not previewed and confirmed.** `ActionPreviewService` decides
  ready / conflict / invalid / skipped; `FileOperationService.applyPreview` applies ready rows
  and nothing else.
- **Paths never leave the selected folder.** A relative target is resolved against the root; an
  absolute target is allowed only for a trash operation. Anything else is `invalid`.
- **Every applied row is recorded as it happens**, in `action_operation_items`, so an interrupted
  apply stays in History and stays undoable. Do not move that recording back to the end of the
  loop.
- **Undo never overwrites.** If the original path is occupied, or the file is no longer where it
  was put, the row fails with the reason and nothing is moved.
- **The renderer has no file-system access.** New disk work goes in `src/main/services/`, exposed
  through `src/main/ipc/` and the preload bridge.
- **Settings are clamped on read** (`SettingsService.coerceSettings`), so a hand-edited or older
  `settings.json` cannot produce an out-of-range value.
- **A scan is read-only** and may be cancelled at any point; a failed image metadata read leaves
  dimensions blank rather than failing the scan.

## Layout

- `src/main/` — Electron main process: `index.ts` (window and lifecycle), `ipc/` (one file per
  domain), `services/` (scan, preview, apply/undo, advanced, database, settings, thumbnails).
- `src/preload/index.ts` — the one `window.api` bridge.
- `src/renderer/` — React pages and components; `i18n.tsx` holds the English/Khmer strings.
- `src/shared/types/app.ts` — the types both sides share.
- `test/` — `check.ts` (the suite), `electron-stub.ts` (stands in for `electron` headless).
- `packaging/` — `gate.sh`, `build-dmg.sh`, `release-push.sh`, `page-sync.sh`.
