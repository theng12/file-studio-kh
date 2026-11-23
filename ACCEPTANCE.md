# File Studio KH — acceptance

What has to be true before this app is called done, and how each one is proved.
A green gate never replaces the last line: the click has to work in the shipped app.

## The screens and what each must do

| Screen | Must do | Proved by |
| --- | --- | --- |
| Dashboard | Show the scan's counts, types, largest folders and warnings for the open folder; offer Rescan and Cancel. | Hidden boot + `ScanService.getSummary` in the check suite |
| Files | List/grid the scan, search, filter by folder/type/extension/tag/size/date, page, select across pages, show thumbnails and dimensions, reveal in Finder. | `ScanService.listFiles` + page filters in the check suite; thumbnails are not checked visually |
| Detail drawer | Reveal, open, copy filename / relative path / full path, set a review status. | Code path only — not yet exercised by a test |
| Actions | Build a dry run for move, trash, rename, sequence, extension case, isolate by format, product folders; show ready/conflict/invalid/skipped, folders to create, affected size; apply only after the confirm box; show the result. | Check suite: preview → apply → undo round trip, root-escape rejection, conflict rows not applied, sequence naming |
| Action presets | Save, load and delete a preset in-app (never a native prompt). | The in-app dialog is code-reviewed; **not yet clicked in a packaged app** |
| History | List previews and applied operations, open item details, undo an applied operation, report a failure with its reason. | Check suite: undo restores, undo refuses an occupied original |
| Advanced | Exact and near-duplicate groups, filename suggestions, product-code grouping, CSV exports, hand a preview to Actions. | Not exercised by a test; needs a hands-on pass on a real folder |
| Settings | Theme, language, scan depth, hidden files, ignored folders, thumbnail cache and limit, trash location, project log, data location, update explanation. | `SettingsService` clamping in the check suite; the rest is code-reviewed |
| Support | Open the donation link through the allowed-external path. | Code path only |

## The rules the app must keep (studio gate, thirteen)

1. No native `confirm`/`alert`/`prompt` — the gate script greps for them.
2. Every skipped row says why; every action shows queued → progress → result — preview rows carry
   `status` + `message`; scan shows progress; apply shows its counts.
3. Identity is the bundle ID `kh.filestudio.app` — in the DMG's Info.plist, the feed and the
   build script.
4. One published version = one artifact: `khu publish` refuses a version already in the feed.
5. Reopen: the app is not a menu-bar app, but `app.on('activate')` recreates the window.
6. No renames are planned; if one happens, bundle id, data folder, feed id and icon move together.
7. No Keychain: the app stores no credentials at all.
8. A publish is proven by reading the served feed back from 1301 — the canonical `release-push.sh`
   (`update-studio-kh/app/packaging/release-push.sh`) does it and
   re-hashes the served artifact.
9. Tests never take the owner's desktop: `--test-mode` boots the app with no window and no Dock
   icon in its own data folder, and the gate fails if this app becomes the frontmost process.
10. Measure, never "looks fine" — **not yet done for this app's layout**.
11. Worktrees, holds and request records reconciled before release — one branch, one record.
12. A green gate proves nothing until the click works in the shipped app — **the packaged app was
    booted but not clicked**.
13. An update holds the queue first and resumes by itself — `UpdateHoldService`, exercised by the
    check suite.

## Known gaps (honest state)

- No hands-on pass on a real messy folder: Files grid, thumbnails, the detail drawer, Advanced
  duplicate comparison, presets and the Khmer strings have not been clicked through.
- Layout is not measured at the house widths.
- The app is signed locally (`KH Studio Local Signing`) and not notarized.
