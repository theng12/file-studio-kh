# Changelog

## 0.6.7 — 2026-11-24

### Fixed

- **Files list columns no longer collide.** The Preview header is now wide enough for its label, and the
  list table keeps a minimum width so the Filename column stays visible and readable instead of collapsing
  behind its neighbors on standard window sizes.

## 0.6.6 — 2026-11-24

### Changed

- **A clearer interface, brought in line with the house design rules.** The version now lives in a pill
  at the bottom of the sidebar that opens What's New (with a Done button and real bullets); the app
  now follows your Mac's appearance (System) by default instead of forcing Light — a Light or Dark
  choice you already made is kept; the Files list names statuses in plain
  words, says "Not scanned yet" before a folder is chosen, and its empty and error messages say what to
  do next.
- Shared layout numbers — spacing, corner radius, text sizes and sidebar width — are defined once as
  tokens instead of scattered values.

## 0.6.5 — 2026-11-23

### Fixed

- **The app starts again.** 0.6.4 added the self-update engine but its build replaced Electron's
  required runtime entitlements, so the app quit about a second after launch (V8 traps without JIT).
  This build restores `allow-jit` and `allow-unsigned-executable-memory` alongside the
  library-validation setting the engine needs. Nothing else changes.

## 0.6.4 — 2026-11-23

### Added

- **The app updates itself.** File Studio KH now carries Sparkle 2 through the shared KH shim.
  Before any update check it asks its own update hold (the endpoint from 0.6.3) and checks only once
  that hold is answered safe; it shows no update window and installs in the background. Builds are
  signed with the local KH Studio identity, not notarized. The first build that carries this is
  installed once by hand; later versions update in place.

## 0.6.3 — 2026-11-23

### Fixed

- **The update hold only trusts a properly protected key.** The pause endpoint used to answer any
  local caller, so any process on the Mac could hold or resume the app. It now reads this app's own
  key file and refuses unless it is readable by you alone (mode 600) and is exactly 64 hex
  characters. A missing, wrongly-permissioned, wrong-length, non-hex or mismatched key is refused
  with a plain reason — on the endpoint and in a banner in the app — never skipped.

## 0.6.2 — 2026-11-21

### Added

- `--test-mode`: the app's headless entry. The window is created but never shown, there is no Dock
  icon, and every byte it writes goes to `FSKH_TEST_DATA_DIR`. The gate boots the shipped main
  process this way.
- `ACCEPTANCE.md`: every screen and what it must do, the thirteen studio rules with how each is
  proved, and the gaps that are still open.

### Fixed

- The gate's credential-store scan tripped the fleet scanner by quoting the words it searches for.

## 0.6.1 — 2026-11-21

### Fixed

- The About panel's "Check for updates" button told people to install a DMG from a release folder.
  It now says where updates actually come from — the Studio Updater reading the shared feed — and
  a development build says it is not updated that way at all.

### Changed

- Dropped the unused `electron-updater` dependency; the Studio Updater installs a new version.

## 0.6.0 — 2026-11-21

### Added

- Joined the studio family: `ABOUT.md`, `AGENTS.md`, a headless check suite, a gate, and the shared
  Updater feed with its release scripts.
- Loopback update hold at `127.0.0.1:8651` so an install pauses new scans and applies, settles what
  is running within its window, and resumes by itself.
- An apply is recorded per file as it runs, so an interrupted apply is still listed in History and
  can still be undone.

### Fixed

- Save preset opened a native prompt, which does nothing in a packaged app. It now asks in an
  in-app dialog and replaces a preset with the same name instead of adding a second copy.
- `npm install` on current npm no longer leaves Electron and the native modules unbuilt
  (`allowScripts` in `package.json`).

## 0.5.1 — 2026-05-23

### Fixed

- Added visible selected-file indicators and an Actions handoff banner in Advanced.
- Added duplicate cleanup previews that keep one file and move the remaining exact duplicates to `_trash`.
- Made Advanced-generated previews open directly in Actions for review and Apply.

## 0.5.0 — 2026-05-23

### Added

- Added an Advanced workspace for duplicate detection, cleanup suggestions, product-code grouping, CSV exports, and visual comparison.
- Added SHA-256 content hashing during scans for exact duplicate groups.
- Added image perceptual hashes during scans for near-duplicate side-by-side comparison.
- Added preview-only filename cleanup suggestions that can build a safe rename preview.
- Added product-code extraction plus product-folder move previews for selected groups.
- Added CSV export for scan results and operation history.
- Added folder change watching with a Rescan now prompt.

## 0.4.0 — 2026-05-23

### Added

- Added Files filters for minimum size, maximum size, modified-after date, and modified-before date.
- Added extension and modified-date visibility to list, grid, and detail views.
- Added optional project-local operation logging to `.file-studio-kh/actions.jsonl` when enabled in Settings.
- Added Dashboard support nudge with a two-week dismiss cooldown and no feature gating.
- Added Settings save-location picker plus a clearer About card with packaged/development status and local-build update guidance.
- Added action previews for Normalize extension casing and Isolate by format into `_pdf`, `_png`, `_raw`, or `_other`.

## 0.3.1 — 2026-05-23

### Added

- Added a persisted Files list/grid view switch so image-heavy folders can be reviewed as thumbnail cards.
- Added a persisted Compact/Comfort/Wide detail-panel preference so the right preview area can be expanded during review.

## 0.3.0 — 2026-05-23

### Added

- Added a Files detail drawer with row-click inspection, Reveal file, Open file, Copy filename, Copy relative path, and Copy full path controls.
- Added automatic restoration of the latest scanned workspace on launch.
- Added stronger action preview summaries, including affected size, folder requirements, operation type, and History logging reminders before Apply.
- Added clickable applied operation details in History with item-level original paths, target paths, messages, and undo status.
- Added manual review statuses for files, including approved, needs review, reference, trash candidate, and organized.
- Added review-status filtering and bulk/detail status updates on the Files page.
- Added ignored folder names in Settings and Dashboard scan warnings for hidden files, ignored folders, `_trash`, and large scans.
- Added action presets for saving and reusing common move, trash, rename, and sequence setups.

## 0.2.5 — 2026-05-23

### Added

- Added a user-facing README explaining what File Studio KH is for, the safe workflow, install steps, and the macOS quarantine removal command for trusted local builds.

## 0.2.4 — 2026-05-23

### Added

- Added Reveal root/folder controls to the Files folder tree so users can open the active folder in Finder before rescanning.

## 0.2.3 — 2026-05-23

### Fixed

- Added a generated macOS `.icns` app icon from the File Studio KH logo and configured packaged DMG builds to use it.

## 0.2.2 — 2026-05-23

### Added

- Wired the language setting into a lightweight translation layer and added Khmer translations for the app shell, navigation, core controls, and key empty/status states.

### Fixed

- Fixed the What's New modal so long changelog content scrolls inside the dialog instead of overflowing past the viewport.
- Fixed Files layout bounds so the app sidebar footer stays visible and the folder tree, file table, and preview panel scroll within the window.

## 0.2.1 — 2026-05-23

### Added

- Added the first File Studio KH logo mark with `KH` inside for the app sidebar and reusable vector asset.

## 0.2.0 — 2026-05-23

### Added

- Added confirmed Apply for ready action preview rows, with on-disk move/rename operations and SQLite-backed operation logs.
- Added undo for applied operations, including clear failure messages when moved files were manually deleted or moved before restore.
- Added Settings controls for `_trash` location: inside the selected root by default, or a custom base folder with per-root subfolders.
- Added applied operation history with undo status and undo results.

## 0.1.2 — 2026-05-23

### Fixed

- Excluded the root-level `_trash` soft-delete folder from normal scan results so future trashed files do not keep appearing as active files.
- Prevented already-trashed paths from being previewed as another trash move.
- Clarified that action preview paths are proposed future destinations, not current moved locations.

## 0.1.1 — 2026-05-23

### Fixed

- Corrected the packaged Electron entry point so macOS DMG builds can launch the app.

## 0.1.0 — 2026-05-22

### Added

- Created the initial Electron, React, Vite, and TypeScript app shell.
- Added the left-sidebar navigation, Settings, Support, What's New, version display, modal, toast, and crash logging foundation.
- Added native folder selection, recent folder storage, SQLite-backed read-only scanning, dashboard summaries, and a first scan-results file list.
- Added folder tree aggregation plus server-side pagination, search, folder, type, extension, and tag filtering for scan results.
- Added image dimension extraction and cached thumbnail previews for image rows.
- Added scan progress updates, scan cancellation, and a clearer gear icon for Settings.
- Added thumbnail cache usage stats, cache size enforcement, and a clear-cache control in Settings.
- Added scan-wide tag aggregation so tag filters show all tags found in the scan.
- Added file selection and preview-only bulk actions for moving, trashing, and rename transforms.
- Added sequential numbering previews and folder-creation details to bulk action previews.
- Added select-all-matching-current-filters and faster navigation from file selection to action previews.
- Added persisted preview history for dry-run bulk action previews.
- Added preview detail reload from History for persisted dry-run previews.
- Added preview revalidation against current disk state, including missing-source detection.
