# File Studio KH

File Studio KH is a local-first macOS desktop app for reviewing and organizing messy folders of product images, PDFs, videos, documents, and other media files.

It is built for folders that already exist on your Mac. You choose a folder, scan it, inspect what is inside, preview bulk file actions, and then apply only the changes you confirm.

## What It Is For

- Scan a working folder and see file counts, folder groups, file types, sizes, dimensions, and possible messy filenames.
- Browse large folders with search, filters, pagination, thumbnails, and a folder tree.
- Select files and preview bulk actions before touching the real files.
- Move selected files to `_trash`, move files to another folder, rename files, or apply sequential numbering.
- Apply ready preview rows only after confirmation.
- Undo applied operations when the moved file still exists and the original location is available.
- Reveal the selected folder in Finder so you can manually edit files, then return to the app and rescan.

## Safety Model

File Studio KH does not copy your selected folder into app storage.

Your files stay in the folder you selected until you confirm an Apply operation. The app keeps metadata, thumbnails, settings, recent folders, previews, and operation logs in app data, but the files themselves remain under your control.

For delete-like behavior, the app uses soft trash:

- By default, Move to `_trash` creates a `_trash` folder inside the selected root.
- You can choose a custom trash location in Settings.
- If you undo later and the file is no longer in `_trash`, the app reports that it may have been manually deleted or moved.

## Basic Workflow

1. Open File Studio KH.
2. Click **Choose folder**.
3. Wait for the scan to finish.
4. Use **Files** to inspect, filter, and select items.
5. Click **Preview action**.
6. Review every original path, proposed path, conflict, invalid row, and skipped row.
7. Confirm and click **Apply ready changes** only when the preview looks correct.
8. Use **History** to review or undo applied operations.
9. Click **Rescan** after manual edits or applied operations.

## Installing From The DMG

1. Open the latest `File Studio KH-*-arm64.dmg`.
2. Drag **File Studio KH.app** into **Applications**.
3. Open it from Applications.

Because local test builds are not Apple-notarized yet, macOS may warn that it cannot verify the app. If right-click > Open does not work, you can remove the quarantine flag manually.

Only run this command for an app you trust and intentionally installed:

```bash
xattr -cr "/Applications/File Studio KH.app"
```

Then open the app again.

If your app was renamed, replace the path with the exact app name in `/Applications`.

## Testing Recommendation

Start with a copied folder, not your only original working folder.

Good first tests:

- Scan a small copied folder.
- Select one or two files.
- Preview Move to `_trash`.
- Apply the ready changes.
- Confirm the files moved into `_trash`.
- Rescan and confirm they no longer appear as active files.
- Use History > Undo and confirm they return.

## Current Notes

- The app is still in active testing.
- The Khmer interface is partially translated; core navigation and controls are translated first.
- Local builds use ad-hoc signing and are not notarized.
- The macOS app icon is generated from the File Studio KH logo.
