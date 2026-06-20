# File Studio KH - Session Handoff

## Start Checklist

1. Read `docs/AGENTS.md`.
2. Read `docs/File_Studio-KH_HANDOFF.md`.
3. Read `docs/APP_PLAN.md`.
4. Read `docs/PROJECT_STATE.md`.
5. Run `npm install` if `node_modules/` is missing.
6. Run `npm run build` before trusting the current state.

## End Checklist

1. Update `docs/PROJECT_STATE.md` after meaningful code or architecture changes.
2. Update `CHANGELOG.md` and `package.json` version for shipped user-visible changes.
3. Rebuild the macOS DMG after every code/UI change so each testable update has a unique versioned installer.
4. Run relevant verification.
5. Check the working tree status.
6. Ask whether to commit and push when this project is inside a git repo.

## Current Next Step

Build and test the macOS DMG for the latest version, then continue hands-on manual testing with a small copied folder. Current support covers Move to folder, Move to `_trash`, rename transforms, sequential numbering, Normalize extension casing, Isolate by format, product-code folders, filename cleanup suggestion previews, folder requirement details, visible-row selection, select-all-matching-current-filters, preview persistence, preview history, preview detail reload, preview revalidation, confirmed Apply for ready rows, applied operation history, optional project-local JSONL logging, Undo, Files list/grid review, size/date filters, adjustable Files detail-panel width, Advanced exact duplicate detection with selected indicators and keep-one/trash-rest previews, perceptual near-duplicate comparison, CSV exports, and folder-change Rescan now prompts. Root-level `_trash` is reserved as the default app soft-delete folder and is excluded from normal scan results; Settings can switch trash to a custom base folder. Duplicate/similarity tools require a fresh scan on `0.5.0+` because older scan rows do not have hashes. Next product step after packaging/manual testing: QA hardening on copied folders.
