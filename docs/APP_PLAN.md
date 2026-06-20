# File Studio KH - App Plan

> _Created: 2026-05-22._
> _Planning source: `File_Studio-KH_HANDOFF.md`, `AGENTS.md`, `SETTINGS_HANDOFF.md`, and `DONATIONS_HANDOFF.md`._

## North Star

File Studio KH is a local-first Electron desktop app for safely organizing messy media and product-file folders.

The app should help users understand a selected folder before it changes anything. Scanning and previews come first; writes happen only after explicit confirmation.

## V1 Product Shape

V1 is a file-operations workbench, not a catalogue database and not a landing page.

Primary flow:

1. User opens the app.
2. User chooses a root folder with the native folder picker.
3. App scans the folder read-only.
4. User reviews dashboard stats, folder tree, file table/grid, thumbnails, and messiness tags.
5. User selects files and prepares a bulk action.
6. App shows a dry-run preview with original paths, destination paths, conflicts, invalid filenames, and skipped files.
7. User confirms.
8. App applies the operation, records every item in SQLite, and optionally writes a project-local JSONL log.
9. User can undo the latest compatible batch after a conflict check.

## Non-Negotiable Safety Rules

- Never permanently delete files.
- Never modify files without preview and confirmation.
- Treat the selected root as real user data, never app code.
- Do not copy selected folder contents into app-owned assets during normal scanning or organization.
- Preserve relative paths when moving files to `_trash`.
- Log every applied file operation.
- Undo must check for conflicts before moving anything back.
- Support spaces, Khmer text, and other non-English filenames and folder names.
- Avoid hardcoded folder paths. The KT Business Image path is sample test data only.

## Technical Stack

- Desktop shell: Electron + `vite-plugin-electron/simple`
- Renderer: React + Vite + TypeScript
- Styling: Tailwind CSS
- Renderer state: Zustand where shared state is useful
- Database: SQLite with `better-sqlite3`
- Image metadata/thumbnails: `sharp`
- Packaging: Electron builder scripts, with macOS arm64 build as the local default
- Filesystem access: main-process services only, exposed via preload IPC

## App Shell

Follow `AGENTS.md`:

- Left sidebar primary navigation, never top-level tabs
- App name and small logo mark at sidebar top
- Persistent version in sidebar footer from `app.getVersion()`
- `What's new` in sidebar footer, parsing `CHANGELOG.md?raw`
- `Support this app` in sidebar footer, following `DONATIONS_HANDOFF.md`
- Settings always reachable
- Shared dismissible `Modal`
- Bottom-center toast system
- Crash logging to `<userData>/crash.log`

Suggested primary nav:

- Dashboard
- Files
- Actions
- History
- Settings
- Support

The folder tree belongs inside the Files workspace as a secondary pane, not as the primary navigation.

## V1 Screens

### Dashboard

Purpose: read-only scan summary and quick confidence check.

Shows:

- Selected root path
- Scan status and last scan time
- Total files and folders
- File type counts
- Extension breakdown
- Largest folders
- Recently modified files
- Messiness summary
- Optional donation nudge from `DONATIONS_HANDOFF.md`

Primary actions:

- Choose folder
- Rescan
- Open Files

### Files

Purpose: main browsing and selection workspace.

Layout:

- Secondary folder tree pane
- Toolbar with rescan, search, filters, and view mode
- Table/grid main area
- Right details/action preview panel
- Bottom status/action-history strip

File table columns:

- Selection checkbox
- Thumbnail or file type icon
- Filename
- Extension
- Relative folder
- Size
- Dimensions when available
- Modified date
- Tags
- Status

Filters:

- Folder
- Extension
- File type
- Messiness tag
- Size range
- Date modified
- Filename search

### Actions

Purpose: prepare bulk actions deliberately.

V1 actions:

- Move selected files to folder
- Create folder
- Move selected files to `_trash`
- Rename selected files
- Replace text in filenames
- Remove text from filenames
- Add prefix
- Add suffix
- Sequential numbering
- Normalize extension casing
- Isolate selected formats into `_pdf`, `_png`, `_raw`, or `_other`

Actions may also be opened from the Files selection panel, but preview/apply logic should be shared.

### History

Purpose: review applied operations and undo compatible batches.

Shows:

- Operation batches
- Timestamp
- Root folder
- Operation type
- Item count
- Success/failed/skipped counts
- Undo status
- Error summary when present

Batch detail shows item-level original path, new path, status, and error message.

### Settings

Use `SETTINGS_HANDOFF.md` universal rows plus File Studio-specific rows.

Universal:

- Theme
- Language
- Save/data location
- About and update check

File Studio-specific:

- Scan depth / recursion limit
- Include hidden files and folders
- Thumbnail cache size
- Clear thumbnail cache
- Action log location preference
- Enable project-local `.file-studio-kh/actions.jsonl`
- Default preview behavior for bulk actions

### Support

Follow `DONATIONS_HANDOFF.md`:

- `/support` page
- Hosted NOWPayments donation link
- Opens in default browser
- No feature gating
- Dashboard nudge with cool-off

## Main Process Services

Suggested service modules:

- `DatabaseService`: schema, migrations, connection, helpers
- `SettingsService`: `settings.json` for small preferences
- `FolderService`: native folder picker, recent folders, folder validation
- `ScanService`: read-only recursive scan, file classification, folder summaries
- `ThumbnailService`: cache thumbnails in app data, never copy source files as assets
- `FileMetadataService`: extension/type/size/dimensions helpers
- `MessinessService`: generic tag detection
- `ActionPreviewService`: generate dry-run results
- `FileOperationService`: apply confirmed moves/renames/trash operations
- `UndoService`: conflict-check and undo latest compatible batch
- `HistoryService`: batch list/detail queries and optional JSONL export
- `AppService`: app info, version, external link allow-list, crash logging

## IPC Surface

Use `domain:action` channels and expose them through `window.api`.

Initial domains:

- `app:getInfo`
- `app:openExternal`
- `settings:get`
- `settings:set`
- `folders:pickRoot`
- `folders:validate`
- `folders:listRecent`
- `folders:setActiveRoot`
- `scan:start`
- `scan:getStatus`
- `scan:getSummary`
- `files:list`
- `files:getDetail`
- `thumbnails:get`
- `actions:preview`
- `actions:apply`
- `history:listBatches`
- `history:getBatch`
- `history:undoLatest`

Renderer must never import Node modules directly.

## SQLite Draft Schema

This is a starting point, not final migration code.

```sql
CREATE TABLE app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE recent_roots (
  id TEXT PRIMARY KEY,
  root_path TEXT NOT NULL UNIQUE,
  label TEXT,
  last_opened_at TEXT NOT NULL
);

CREATE TABLE scan_batches (
  id TEXT PRIMARY KEY,
  root_path TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  file_count INTEGER NOT NULL DEFAULT 0,
  folder_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE TABLE scanned_files (
  id TEXT PRIMARY KEY,
  scan_batch_id TEXT NOT NULL,
  root_path TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  extension TEXT NOT NULL,
  file_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  modified_at TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  tags_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'needs_review',
  FOREIGN KEY (scan_batch_id) REFERENCES scan_batches(id) ON DELETE CASCADE
);

CREATE INDEX idx_scanned_files_batch ON scanned_files(scan_batch_id);
CREATE INDEX idx_scanned_files_type ON scanned_files(file_type);
CREATE INDEX idx_scanned_files_extension ON scanned_files(extension);

CREATE TABLE operation_batches (
  id TEXT PRIMARY KEY,
  root_path TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  applied_at TEXT,
  status TEXT NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  undo_status TEXT NOT NULL DEFAULT 'not_undone',
  error_message TEXT
);

CREATE TABLE operation_items (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  original_relative_path TEXT NOT NULL,
  new_relative_path TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  FOREIGN KEY (batch_id) REFERENCES operation_batches(id) ON DELETE CASCADE
);

CREATE INDEX idx_operation_items_batch ON operation_items(batch_id);
```

## Preview and Apply Contract

Preview result should include:

- Batch ID or preview ID
- Operation type
- Affected item count
- Per-item original path
- Per-item proposed new path
- Conflict status
- Invalid filename status
- Skip reason when applicable
- Summary counts

Apply rules:

- Apply only a preview generated for the current selected root and selected files.
- Re-check conflicts immediately before writing.
- Create folders only when required and shown in preview.
- Use filesystem operations that preserve files; never unlink as a delete action.
- Stop or mark item failures per operation policy, but never hide partial failures.
- Record both success and failure rows.

## Undo Contract

V1 supports undo for the latest compatible applied batch:

- Move
- Rename
- Move to `_trash`

Undo must:

- Read operation items from SQLite
- Verify current source/destination paths
- Detect conflicts before writing
- Show a preview/confirmation before undo if any conflict exists
- Record undo status on the original batch

## Milestones

### Milestone 0 - Project Scaffold

- Create Electron + React + Vite + TypeScript app
- Add Tailwind
- Add sidebar shell, routes, shared UI components, toast, modal
- Add `CHANGELOG.md`, version display, crash log
- Add Settings and Support skeletons

Exit criteria:

- App launches in dev
- Sidebar routes work
- Version and Settings are visible
- Crash log is written

### Milestone 1 - Folder Selection and Read-Only Scan

- Native folder picker
- Recent folders
- Folder validation
- Recursive scanner with limits/settings
- SQLite schema for roots and scan batches
- Dashboard summary

Exit criteria:

- User can select the KT sample folder
- Scan completes without modifying files
- Dashboard shows counts and extension breakdown

### Milestone 2 - File Browser and Tags

- Files table/grid
- Folder tree secondary pane
- Search and filters
- Image dimensions where available
- Messiness tags
- Pagination

Exit criteria:

- User can browse, filter, and select files
- Khmer/non-English paths render correctly
- Table remains usable with large folders

### Milestone 3 - Thumbnails

- Thumbnail cache in app data
- Thumbnail IPC/protocol
- Cache clear setting
- Safe fallback icons for non-images or failed thumbnails

Exit criteria:

- Images show thumbnails
- Source files are not copied into app assets
- Cache can be cleared

### Milestone 4 - Preview-Only Actions

- Shared action preview engine
- Move, trash, rename, replace/remove/add prefix/suffix, sequential numbering
- Conflict and invalid filename detection
- Preview UI

Exit criteria:

- User can generate dry runs with accurate before/after paths
- No filesystem writes occur in this milestone

### Milestone 5 - Apply and Log

- Confirmed operation apply
- SQLite operation batches/items
- Optional JSONL root-local log
- History page
- Toast/error handling

Exit criteria:

- Confirmed operations modify files as previewed
- Every item is logged
- Failures are visible

### Milestone 6 - Soft Trash and Undo

- `_trash` move preserving relative paths
- Latest-batch undo
- Undo conflict detection
- History detail view

Exit criteria:

- Move/rename/trash operations can be undone when paths are safe
- Undo refuses or warns on conflicts

### Milestone 7 - Packaging Polish

- Changelog flow
- Donation nudge
- Update About card
- Build macOS arm64 DMG
- Manual QA on sample folder copy

Exit criteria:

- Packaged app opens
- Core workflow works on a copied test folder
- Version and changelog match the build

## Manual QA Folder Strategy

Never test destructive operations directly on the original sample folder.

Recommended approach:

1. Copy `/Users/you/Pictures/KT Business Image` to a temporary QA folder.
2. Run scans and write operations only on the copy.
3. Confirm `_trash` preserves relative paths.
4. Confirm undo restores the expected files.
5. Delete the QA copy manually after review.

## Open Product Decisions

These can wait until implementation reaches the relevant milestone:

- Whether V1 needs both table and grid views, or table first with thumbnails.
- Whether action preview should live in a modal, right panel, or dedicated Actions page.
- Whether scan results should persist per root or only keep the latest scan.
- Exact default scan depth.
- Exact hidden-file default: likely hide noisy system files but show a filter/count.
- Whether duplicate-by-hash belongs in late V1 or V2.
