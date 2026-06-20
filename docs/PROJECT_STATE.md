# File Studio KH - Project State

> _Last updated: 2026-05-23._

## Current Status

Milestone 0 through Milestone 6 are implemented at V1 level and ready for deeper manual testing. Milestone 7 packaging polish is partially implemented.

The project now has an Electron + React + Vite + TypeScript app scaffold with:

- Left sidebar primary navigation
- Dashboard, Files, Actions, History, Settings, and Support routes
- Advanced route for duplicate detection, cleanup suggestions, product-code grouping, exports, and visual comparison
- Persistent version display in the sidebar footer
- `What's new` modal backed by `CHANGELOG.md?raw`
- Support page using the hosted NOWPayments donation link flow
- Shared dismissible `Modal` component
- Bottom-center toast system
- Settings IPC backed by `<userData>/settings.json`
- App info and external-link IPC
- Main-process crash/lifecycle logging to `<userData>/crash.log`
- Tailwind styling
- Production build scripts
- Native folder picker IPC
- Recent folders stored in SQLite
- Initial SQLite database service under `<userData>/data/file-studio-kh.sqlite`
- Read-only recursive scan service
- File classification by extension
- Initial messiness tags for camera names, copies, repeated final names, generic modifiers, system files, very large files, and tiny image files
- Dashboard scan summary
- Files page populated from latest scan results
- Files page folder tree aggregation
- Server-side file list pagination, search, folder filter, file type filter, extension filter, and tag filter
- Image dimension extraction during scan via `sharp`
- Thumbnail cache under `<userData>/data/thumbnail-cache`
- Thumbnail IPC serving data URLs for visible image rows
- Files page thumbnail preview and dimensions columns
- Async scan traversal using promise-based filesystem calls
- Scan progress events bridged from main process to renderer
- Scan cancel IPC and cancel buttons in the app header, Dashboard, and Files page
- Settings sidebar icon changed to a gear
- Thumbnail cache stats, clear-cache, and limit-enforcement IPC
- Settings UI for thumbnail cache usage, cache size limit, and clearing cached thumbnails
- Scan-wide tag aggregation IPC
- Files tag filter now shows all tags found in the current scan with counts
- File row selection in the Files page
- Preview-only action service and IPC for Move to folder, Move to `_trash`, and rename transforms
- Actions page preview form and dry-run table with ready/conflict/invalid/skipped summaries
- Sequential numbering preview operation
- Action previews now list folders that would need to be created on apply
- Actions page guides users back to Files when no rows are selected
- Files page can select all rows matching the current filters across all pages
- Files page has clear-selection and direct preview-action controls
- Action previews are persisted to the app SQLite database
- History page lists recent dry-run previews and their ready/issue counts
- History page can open a persisted preview and show item-level dry-run details
- History page can revalidate a persisted preview against current disk state and save the new dry-run result
- Action preview now skips items whose source file is missing from disk
- Root-level `_trash` is reserved as the app soft-delete folder and excluded from normal scan results
- Trash previews skip already-trashed paths
- Confirmed Apply for ready action preview rows
- SQLite-backed applied operation history
- Undo for applied operations, with failure reporting when a moved file is missing or the original path is occupied
- Settings controls for `_trash` location: inside the selected root or a custom base folder
- Files page Reveal root/folder control for opening the active root or selected folder in Finder before rescanning
- User-facing root README explaining the app purpose, safe workflow, install steps, and trusted-local-build quarantine command
- Files detail drawer with Reveal file, Open file, Copy filename, Copy relative path, and Copy full path controls
- Latest scanned workspace restores on launch when scan history exists
- Action preview summaries now include affected size and stronger Apply review context
- History applied operations can be opened to inspect item-level original paths, target paths, messages, and undo status
- Manual review statuses can be assigned from Files and filtered in the file list
- Settings supports comma-separated ignored folder names for scans
- Dashboard shows scan warnings for hidden file behavior, ignored folders, `_trash`, and large scans
- Actions supports saved action presets in local storage
- Files page supports a persisted list/grid view switch for denser table review or larger thumbnail-card review
- Files detail panel supports a persisted Compact/Comfort/Wide width preference
- Files page supports size-range and modified-date filters
- Files list, grid, and detail views show extension and modified-date metadata
- File Studio KH sidebar logo mark with `KH` inside and reusable SVG asset
- macOS app icon generated from the File Studio KH logo and wired into electron-builder as `build/icon.icns`
- Lightweight renderer translation layer connected to the Language setting, with Khmer coverage for shell navigation and core controls
- Optional project-local operation logging to `.file-studio-kh/actions.jsonl` when enabled in Settings
- Dashboard support nudge with dismiss cooldown and no feature gating
- Settings save-location picker and clearer About/check-update guidance for local DMG builds
- Action previews for Normalize extension casing and Isolate by format into `_pdf`, `_png`, `_raw`, or `_other`
- Scan stores SHA-256 content hashes for exact duplicate detection on fresh scans
- Scan stores image perceptual hashes for near-duplicate comparison on fresh scans
- Advanced shows exact duplicate groups and near-duplicate side-by-side image groups
- Advanced shows preview-only filename cleanup suggestions and can build a safe rename preview
- Advanced extracts product codes and can build product-folder move previews
- Advanced exports scan results and operation history as CSV
- App watches the active root for folder changes and offers Rescan now
- Advanced duplicate groups show selected-file indicators, can build keep-one/trash-rest previews, and hand generated previews directly to Actions

## Verification

Completed:

- `npm install`
- `npm run rebuild:native`
- `npm run build`
- Runtime smoke test: `npm run dev` served the renderer at `http://localhost:5173/` and `curl -I` returned `HTTP/1.1 200 OK`
- Production Electron entry smoke test: `./node_modules/.bin/electron dist-electron/index.js` booted main process, wrote lifecycle logs, loaded the renderer, and reached IPC without native SQLite errors
- Production Electron entry smoke test repeated after file query/filter work; app booted cleanly
- `npm run rebuild:native` and `npm run build` passed after adding `sharp`
- Production Electron entry smoke test repeated after thumbnail/dimension work; app booted cleanly
- `npm run build` passed after scan progress/cancel work
- Production Electron entry smoke test repeated after progress/cancel work; app booted cleanly
- `npm run build` passed after thumbnail cache management work
- Production Electron entry smoke test repeated after cache management work; app booted cleanly
- `npm run build` passed after scan-wide tag aggregation
- Production Electron entry smoke test repeated after tag aggregation; app booted cleanly
- `npm run build` passed after preview-only action foundation
- Production Electron entry smoke test repeated after action preview work; app booted cleanly
- `npm run build` passed after sequential numbering and folder-creation preview details
- Production Electron entry smoke test repeated after sequential preview work; app booted cleanly
- `npm run build` passed after selection-flow improvements
- Production Electron entry smoke test repeated after selection-flow work; app booted cleanly
- `npm run build` passed after preview persistence/history
- Production Electron entry smoke test repeated after preview persistence/history; app booted cleanly
- `npm run build` passed after preview detail reload support
- Production Electron entry smoke test repeated after preview detail reload support; app booted cleanly
- `npm run build` passed after preview revalidation support
- Production Electron entry smoke test repeated after preview revalidation support; app booted cleanly
- `npm run build:mac:arm64` initially failed because the packaged app entry pointed to `dist-electron/main/index.js` while the build emits `dist-electron/index.js`; package metadata was corrected and version bumped to `0.1.1`
- `npm run build:mac:arm64` passed for `0.1.1` and produced `release/File Studio KH-0.1.1-arm64.dmg`
- Packaged app smoke test passed: `release/mac-arm64/File Studio KH.app/Contents/MacOS/File Studio KH` reached `[app:ready]` and was stopped cleanly
- `npm run build` passed after reserving root-level `_trash` for soft-delete behavior
- `npm run build:mac:arm64` passed for `0.1.2` and produced `release/File Studio KH-0.1.2-arm64.dmg`
- Packaged `0.1.2` smoke test passed: the app reached `[app:ready]` and was stopped cleanly
- `npm run build` passed after adding confirmed Apply, operation history, undo, and configurable trash location
- `npm run build:mac:arm64` passed for `0.2.0` and produced `release/File Studio KH-0.2.0-arm64.dmg`
- Packaged `0.2.0` smoke test passed: the app reached `[app:ready]` and was stopped cleanly
- `npm run build` passed after adding the sidebar logo mark
- `npm run build:mac:arm64` passed for `0.2.1` and produced `release/File Studio KH-0.2.1-arm64.dmg`
- Packaged `0.2.1` smoke test passed: the app reached `[app:ready]` and was stopped cleanly
- `npm run build` passed after connecting the Language setting to visible Khmer translations
- `npm run build` passed after fixing the What's New modal scroll behavior
- `npm run build` passed after constraining the app shell and Files page to viewport-bounded internal scrolling
- `npm run build:mac:arm64` passed for `0.2.2` and produced `release/File Studio KH-0.2.2-arm64.dmg`
- Packaged `0.2.2` smoke test passed: the app reached `[app:ready]` and was stopped cleanly
- `npm run build:mac:arm64` passed for `0.2.3` and produced `release/File Studio KH-0.2.3-arm64.dmg`
- Packaged `0.2.3` smoke test passed: the app reached `[app:ready]`, `CFBundleIconFile` is `icon.icns`, and the bundled icon exists in app resources
- `npm run build` passed after adding the Files Reveal root/folder control
- `npm run build:mac:arm64` passed for `0.2.4` and produced `release/File Studio KH-0.2.4-arm64.dmg`
- Packaged `0.2.4` smoke test passed: the app reached `[app:ready]` and was stopped cleanly
- `npm run build:mac:arm64` passed for `0.2.5` and produced `release/File Studio KH-0.2.5-arm64.dmg`
- Packaged `0.2.5` smoke test passed: the app reached `[app:ready]`, `README.md` is included in app resources, and the app was stopped cleanly
- `npm run build` passed after adding file details, workspace restore, preview summaries, operation details, review statuses, ignored folders, scan warnings, and action presets
- `npm run build:mac:arm64` passed for `0.3.0` and produced `release/File Studio KH-0.3.0-arm64.dmg`
- Packaged `0.3.0` smoke test passed: the app reached `[app:ready]` and was stopped cleanly
- `npm run build` passed after adding Files grid view and adjustable detail-panel widths
- `npm run build:mac:arm64` passed for `0.3.1` and produced `release/File Studio KH-0.3.1-arm64.dmg`
- Packaged `0.3.1` smoke test passed: the app reached `[app:ready]` and the release test process was stopped cleanly
- `npm run build` passed after adding size/date filters, project-local JSONL logging, Dashboard support nudge, Settings/About polish, Normalize extension casing, and Isolate by format actions
- `npm run build:mac:arm64` passed for `0.4.0` and produced `release/File Studio KH-0.4.0-arm64.dmg`
- Packaged `0.4.0` smoke test passed: the app reached `[app:ready]` and the release test process was stopped cleanly
- `npm run build` passed after adding Advanced workspace, scan hashes, near-duplicate comparison, filename suggestion previews, product-code grouping, CSV exports, and folder watch prompts
- `npm run build:mac:arm64` passed for `0.5.0` and produced `release/File Studio KH-0.5.0-arm64.dmg`
- Packaged `0.5.0` smoke test passed: the app reached `[app:ready]` and the release test process was stopped cleanly
- `npm run build` passed after fixing Advanced duplicate selection visibility and generated-preview handoff to Actions
- `npm run build:mac:arm64` passed for `0.5.1` and produced `release/File Studio KH-0.5.1-arm64.dmg`
- Packaged `0.5.1` smoke test passed: the app reached `[app:ready]` and the release test process was stopped cleanly

Dev/Electron smoke-test processes were stopped after verification.

## Current Limitations

- Folder picker, scanning, folder tree, pagination, and filters are implemented but need hands-on manual testing with real copied folders.
- Scan is now async and progress-aware, but still runs in the main process. A dedicated worker process/thread may still be useful for very large folders.
- Thumbnail generation happens on demand from visible rows and enforces the configured cache size after new thumbnails are created.
- Cache clearing is implemented in Settings.
- Image dimensions are captured during scan, but failed metadata reads quietly show blank dimensions.
- Exact duplicate and near-duplicate tools require a fresh scan after `0.5.0` so hash fields exist.
- Near-duplicate comparison is perceptual-hash based and limited to the first 800 hashed images per scan for responsiveness.
- Actions page now applies only ready rows from a saved preview after explicit confirmation.
- `_trash` is not created during preview. It is created only by confirmed Apply when the default inside-root trash mode is used.
- Once files are moved into root-level `_trash`, a rescan should not show those files as active file results.
- Custom trash mode stores files under the configured base folder plus the selected root folder name, preserving relative paths.
- Khmer translation coverage is partial but live. Navigation, page titles, major controls, and key empty/status states translate; longer explanatory copy still needs human review before full coverage.
- Selection can be made from visible rows or all rows matching the current filters across pages.
- History includes preview history and applied operation details with undo status.
- Settings has app-specific controls and a save-location picker, but export/support-bundle workflows are not implemented yet.
- Support uses the configured hosted donation URL, and Dashboard has a dismissible nudge.

## Next Recommended Step

Start manual testing from the latest DMG using a copied/safe folder.

Test:

- Open the latest `release/File Studio KH-*-arm64.dmg`.
- Drag `File Studio KH.app` to Applications or run the packaged app from the mounted DMG.
- Choose a small-to-medium folder first.
- Confirm the dashboard counts and file list look plausible.
- In Files, switch between List and Grid, and try Compact, Comfort, and Wide detail-panel widths.
- Try size and modified-date filters, then Select matching.
- Build a small Move to `_trash` preview, apply it, then rescan and confirm moved files no longer show as active files.
- Build Normalize extension casing and Isolate by format previews on a copied folder before applying.
- Rescan once before testing Advanced duplicate/similarity tools so hashes are available.
- In Advanced, test exact duplicate groups, filename cleanup preview, product-code folder preview, scan CSV export, operation CSV export, and near-duplicate side-by-side comparison.
- Change a file in Finder and confirm the app offers Rescan now.
- Enable project-local logging in Settings and confirm `.file-studio-kh/actions.jsonl` is written after Apply.
- Use History Undo and confirm the files return to their original paths.
- Then test a copied version of `/Users/you/Pictures/KT Business Image`.

Next build step:

- Consider moving scanning to a dedicated worker if manual testing shows the main process still feels busy on very large folders.
- Consider adding a cache folder reveal action later if debugging support needs it.
- Next major product step is QA hardening and then advanced duplicate/similarity detection once the V1 workflow is trusted on copied folders.
