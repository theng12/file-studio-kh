# File Studio KH - Handoff

> _Last revised: 2026-05-22. Direction confirmed by Theng: Electron + React/Vite + TypeScript from the start._
> _For global conventions see `AGENTS.md` in this folder. If anything below contradicts AGENTS.md, AGENTS.md wins unless this file calls out a File Studio-specific exception._

## Product Vision

Build **File Studio KH**, a generic local-first desktop app for organizing messy product image and media folders.

The app should work for any business or individual who has product images, supplier images, development references, catalog photos, PDFs, screenshots, and mixed media scattered across folders. It should not be hardcoded to one company, one brand, or one folder path.

The core idea: let users choose a folder, scan it safely, understand what is messy, then perform bulk organization actions with previews and reversible file moves.

## Primary Use Case

A user has a messy folder of product-related files. Some files are already organized, some are not, some are product-ready, some are references, and some may be trash.

The app helps the user:

- Pick a root folder from their computer
- See the folder structure clearly
- Identify file types and messy naming patterns
- Filter and isolate groups of files
- Bulk rename files safely
- Move selected files into better folders
- Soft-delete files into a `_trash` folder
- Keep an action log for review and undo

## Important Design Principle

This app manages real business files, so safety matters more than speed.

Requirements:

- Never permanently delete files.
- Always preview bulk actions before applying.
- Use soft delete by moving files to a `_trash` folder.
- Keep an operation log.
- Avoid hardcoded paths.
- Support folder names and filenames with non-English text.
- Treat the selected folder as user data, not as app code.

## Generic App Requirements

### Folder Picker

The app must let users select a folder to manage.

Direction:

- Use Electron's native folder picker from the start.
- Keep a recent folders list.
- Validate that the folder exists and is readable.
- Make it clear that scanning is read-only and file operations happen only after preview and confirmation.
- Do not ship a local-web or Express prototype first. This app manages real desktop folders, so the desktop shell is part of V1.

## Suggested Architecture

### V1 Desktop Stack

- Shell: Electron + `vite-plugin-electron/simple`
- Frontend: React + Vite
- Language: TypeScript (`.ts` / `.tsx`)
- Styling: Tailwind CSS
- State: Zustand where shared renderer state is useful
- Database: SQLite via `better-sqlite3`
- File operations: Electron main-process services using Node filesystem APIs
- Storage: app data directory for settings, database, scan cache, thumbnails, logs, recent folders, and undo metadata
- Folder picker: native OS folder picker

File-management exception to `AGENTS.md §9`:

- Do not copy the selected user folder's contents into app-owned `assets/`.
- The selected root is the user's real working folder. Scanning reads it in place.
- Confirmed move, rename, trash, and undo operations act on the real files.
- App data may store metadata, thumbnails, caches, action logs, and undo state only.
- Any future export/import workflow must say clearly when it creates copies.

Recommended path:

1. Build the Electron app shell first.
2. Keep filesystem logic modular in main-process services.
3. Build read-only folder selection, scanning, and browsing before any write operation.
4. Add preview-only bulk operations.
5. Add confirmed apply operations with database-backed logging.

## V1 Features

### 1. App Shell

Follow `AGENTS.md` for the desktop app shell:

- Left sidebar primary navigation, never top-level tabs
- Persistent version in the sidebar footer
- `What's new` in the sidebar footer, backed by `CHANGELOG.md`
- `Support this app` in the sidebar footer, following `DONATIONS_HANDOFF.md`
- Settings always reachable
- Shared dismissible `Modal` component for modal flows
- Crash logging in the Electron main process

Primary nav should include practical work areas such as Dashboard, Files, Actions, History, Settings, and Support. The exact labels can change during implementation, but the left sidebar remains the primary navigation.

### 2. Folder Selection

Users should be able to:

- Select a root folder
- See the selected folder path
- Rescan the folder
- Change folders
- See recent folders

The app should not assume any fixed folder structure.

### 3. Scanner Dashboard

Read-only scanning first.

Show:

- Folder tree
- Total file count
- Total folder count
- File counts by extension
- Image, PDF, video, document, and other counts
- Largest folders
- Recently modified files
- Potentially messy files

### 4. File Browser

Provide a table and/or thumbnail grid.

Show:

- Thumbnail preview for images
- Filename
- Extension
- Folder path
- File size
- Image dimensions when available
- Last modified date
- Detected tags
- Current status, such as `organized`, `needs_review`, `trash_candidate`

Filters:

- Folder
- Extension
- File type
- Messiness tag
- Size range
- Date modified
- Search by filename

### 5. Messiness Detection

Initial generic rules:

- Camera-style names, such as `IMG_1234`, `DSC_1234`, or `PXL_1234`
- Filenames containing words like `copy`, `final final`, `new`, `large`, `small`, `edited`
- Mixed extensions, such as `.jpg` and `.jpeg`
- Non-image files inside image-heavy folders
- Empty folders
- Duplicate filenames in different folders
- Very small image dimensions
- Very large files
- Unsupported formats
- Hidden system files like `.DS_Store`

The app should show these as tags, not as absolute judgments.

### 6. Bulk Actions

All bulk actions must have a preview step.

Actions:

- Move selected files to a folder
- Create folder
- Move selected files to `_trash`
- Rename selected files
- Replace text in filenames
- Remove text from filenames
- Add prefix
- Add suffix
- Sequential numbering
- Normalize extension casing
- Isolate selected formats into folders such as `_pdf`, `_png`, `_raw`, or `_other`

### 7. Preview Before Apply

Before applying an action, show:

- Original path
- New path
- Conflicts
- Invalid filenames
- Files that cannot be moved
- Number of affected files

The user must confirm before changes are written.

### 8. Soft Trash

Soft delete should move files into a `_trash` folder inside the selected root.

Example:

Original:

`Brand A/New Products/IMG_1234 Large.jpeg`

Trash destination:

`_trash/Brand A/New Products/IMG_1234 Large.jpeg`

This preserves folder context and reduces filename collisions.

### 9. Action Log

Record every applied action.

Suggested fields:

- Timestamp
- Selected root folder
- Operation type
- Original path
- New path
- Status
- Error message, if any
- Batch ID

Storage:

- Default source of truth: SQLite database in the app data folder via `better-sqlite3`
- Store recent folders, scan batches, operation batches, operation items, undo status, and user preferences in app data
- Optional project-local log: `.file-studio-kh/actions.jsonl` inside the selected root, controlled by a Settings toggle
- Project-local logs are for review/export. They are not required for the app to know its own history.

Use `settings.json` for small app preferences per `SETTINGS_HANDOFF.md`; use SQLite for operational history and scan/action data.

### 10. Undo

V1 can support simple undo for the most recent batch.

Undoable operations:

- Move
- Rename
- Move to `_trash`

Undo should use the action log and check for conflicts before applying.

## Later Features

- Duplicate detection by file hash
- Near-duplicate detection by image similarity
- Product code extraction
- Brand/category inference from folder names
- User-defined naming templates
- Image dimension standardization
- Background cleanup workflow
- Export catalog CSV/JSON
- Mark files as `approved`, `needs_review`, `reference`, or `trash_candidate`
- Saved organization rules per project
- Dry-run reports
- Multi-language UI
- Support for RAW formats
- Cloud drive awareness for Dropbox, Google Drive, OneDrive, and iCloud folders

## UX Direction

The app should feel like a practical file operations tool.

Design qualities:

- Clear
- Dense but readable
- Calm
- Safe
- Fast to scan
- Built for repeated use

Avoid:

- Marketing-style landing pages
- Permanent delete
- Hidden destructive actions
- Overly playful UI
- Hardcoded business-specific labels

Useful UI areas:

- Left sidebar: primary app navigation, Settings, Support, What's New, and version
- Main page header: current page title plus selected root chip/context
- Files workspace: folder tree as a secondary pane, not the primary navigation
- Toolbar inside the active workspace: scan, folder picker, filters, and search
- Main area: file table and/or thumbnail grid
- Right panel: selected file details and bulk action preview
- Bottom/status area: scan results, warnings, and action history

Settings should include the universal rows from `SETTINGS_HANDOFF.md` plus File Studio-specific settings:

- Scan depth / recursion limit
- Hidden files and hidden folders handling
- Thumbnail cache size and clear-cache action
- Action log location preference
- Optional project-local `.file-studio-kh/actions.jsonl` logging
- Default preview behavior for bulk actions
- Theme and language

Support should follow `DONATIONS_HANDOFF.md`: a `/support` page from the sidebar footer, optional dashboard nudge with cool-off, and no feature gating.

## Example Test Folder

During development, one possible real-world test folder is:

`/Users/you/Pictures/KT Business Image`

This folder contains construction material product images and brand folders. It should be treated only as a sample folder, not as a hardcoded app path.

Example top-level folders observed:

- `Brand - COTTO`
- `Brand - KASAPRO`
- `Brand - MACEPRO`
- `Brand - ROYAL`

Example messiness observed:

- Camera filenames like `IMG_4644 Large.jpeg`
- Product-code filenames like `IS-R1131-SS-1.jpg`
- Mixed `.jpg`, `.jpeg`, `.png`, and `.pdf`
- `.DS_Store` files
- Folder names with Khmer text

## Suggested First Build Plan

1. Create the app in a separate development folder, not inside the selected image folder.
2. Build the Electron + React/Vite + TypeScript shell with left sidebar, Settings, Support, What's New, version display, and crash logging.
3. Build native folder selection, recent folders, and read-only scanning.
4. Build the dashboard and file browser.
5. Add messiness tags.
6. Add thumbnail serving and cache management without copying source files into app assets.
7. Add preview-only bulk operations.
8. Add confirmed apply operations with SQLite-backed logging.
9. Add soft trash.
10. Add undo for the latest batch.
11. Package as a desktop app after core workflows are proven.

## Non-Negotiables

- No permanent delete.
- No file modifications without preview and confirmation.
- No hardcoded root folder.
- No copying selected folder contents into app-owned assets during normal scanning or organization.
- Support arbitrary folder structures.
- Support filenames with spaces and non-English characters.
- Keep logs of actions.
- Build the app outside user data folders.
