# File Studio KH — what it is

File Studio KH is a macOS desktop app for tidying up a messy folder that already
exists on the Mac. You pick a folder, it scans it, you look at what is in there,
you build a bulk action as a dry run, and only the rows you confirm are applied to
the real files.

It never copies a folder into app storage, and it never deletes anything: "delete"
means moving the file into `_trash`.

## What it does

- Scans a folder (depth, hidden files and ignored folder names are settings) and
  shows file counts, folder groups, extensions, sizes, image dimensions and
  messiness tags such as camera names, copies, repeated names and system files.
- Browses the results as a list or a grid, with search, folder tree, file-type,
  extension, tag, size and modified-date filters, pages and image thumbnails.
- Builds a dry run before touching anything: move to a folder, move to `_trash`,
  rename (prefix, suffix, find/replace, remove text), sequential numbering,
  extension-case normalising, isolate by format, product-code folders and filename
  cleanup suggestions. Every row is shown as ready, conflict, invalid or skipped,
  with original and proposed paths.
- Applies only the ready rows, and only after the box that says it will modify
  files on disk is ticked.
- Keeps a history of previews and applied operations, and undoes an applied
  operation when the file is still where it was put and the original name is free.
- Finds exact duplicates (SHA-256) and near duplicates (perceptual hash) on a fresh
  scan, exports scan results and operation history as CSV, and offers keep-one /
  trash-the-rest previews.
- Watches the open folder and offers Rescan when something changes outside the app.
- Reveals a folder or file in Finder and opens a file in its own app, always
  inside the folder you selected.

## Safety model

- Files stay where they are. App data holds metadata, thumbnails, settings,
  previews and the operation log only.
- Soft delete only. `_trash` sits inside the selected folder by default, or in a
  custom base folder you choose in Settings, which keeps the folder name and the
  relative path.
- `_trash` is reserved and left out of scan results, so a trashed file does not
  come back as an active row.
- Paths are resolved against the selected folder. An absolute target is allowed
  only for a trash operation, and anything that resolves outside the folder is
  marked invalid instead of being applied.
- Previews are dry runs and create nothing. Folders are created only by a confirmed
  apply.
- An apply is recorded per file as it runs, so one interrupted by a crash, a power
  cut or an update is still listed in History and can still be undone.
- No Keychain, no secrets: there is nothing to authenticate to, and the app stores
  no credentials.

## How it is built

Electron 39 + React 19 + TypeScript, bundled by Vite (`vite-plugin-electron`);
`better-sqlite3` for the local database under the app's own data folder and
`sharp` for image dimensions, perceptual hashes and thumbnails. The renderer talks
to the main process through one preload bridge (`window.api`); nothing in the
renderer touches the file system directly.

```sh
npm install
npm run build          # typecheck + renderer and main bundles
npm test               # headless check suite, own temp data folder
packaging/gate.sh      # everything the gate runs before a release
packaging/build-dmg.sh # signed-then-ad-hoc DMG into dist/
```

## Where it fits

It is a standalone local utility. It does not use Studio Hub, GatewayKH or a job
queue, and it holds no catalogue: Media Studio KH keeps product records and
Library Studio KH manages an arr-stack library, while this app works on whatever
folder you point it at. Updates go through the shared Updater feed.

## Current version

0.6.2, from the `version` field in `package.json`; the newest `CHANGELOG.md` entry
agrees.
