# Core Docs — index

This folder is the shared library of conventions + portable feature specs that I (Theng) reuse across every desktop / web app I build with Claude.

Two kinds of file live here, distinguished by naming:

| Pattern | Purpose |
|---|---|
| **`AGENTS.md`** (no suffix) | Global build conventions that apply to every app — navigation, modals, save semantics, IPC, DB, file layout, release cadence, etc. The receiving session reads this first. |
| **`*_HANDOFF.md`** (suffix `_HANDOFF`) | Portable specs for a single feature (Brand, Settings, Donations, …). Paste one into a new project's working directory and a fresh Claude session can build that feature without reading the original codebase. |
| **`APP_PLAN.md`** | The File Studio KH implementation roadmap: V1 product shape, screens, services, IPC, draft schema, milestones, and QA strategy. |
| **`PROJECT_STATE.md`** | Current app state, verification notes, known gaps, and next recommended step. |
| **`HANDOFF.md`** | Start/end checklist for future sessions. |
| **`CLAUDE.md`** | A stub that points at `AGENTS.md`. Kept around because some tools look for the filename specifically; never edit it. |

---

## Files in this folder

### Conventions (read first in any new session)

| File | What's inside |
|---|---|
| [`AGENTS.md`](./AGENTS.md) | The single source of truth for build conventions. 23 sections covering nav, modals, save semantics, toasts, asset storage, pagination, import/export, multi-image, smart filename matching, DB, IPC, stack, file layout, tone, crash logging, release cadence, cross-tool handoff, git checkpoint. |
| [`CLAUDE.md`](./CLAUDE.md) | Stub → `AGENTS.md`. Don't edit. |
| [`APP_PLAN.md`](./APP_PLAN.md) | File Studio KH's concrete V1 roadmap, including app screens, main-process services, IPC channels, draft SQLite schema, implementation milestones, and manual QA strategy. |
| [`PROJECT_STATE.md`](./PROJECT_STATE.md) | Current architecture/behavior/known-gaps snapshot for this app. |
| [`HANDOFF.md`](./HANDOFF.md) | Session checklist for starting and ending work cleanly. |

### Portable feature specs (paste these into new projects)

| File | What's inside | Status |
|---|---|---|
| [`SETTINGS_HANDOFF.md`](./SETTINGS_HANDOFF.md) | Universal settings page rows: Theme (default Light), Language, Save location (click to reveal), About + check-for-updates. The four rows every app needs. | Stable |
| [`DONATIONS_HANDOFF.md`](./DONATIONS_HANDOFF.md) | The `Support this app` flow: sidebar entry, `/support` page, hosted NOWPayments donation link, Dashboard nudge with 7-day cool-off. No license gating — donations are voluntary. | Stable |
| [`BRAND_HANDOFF.md`](./BRAND_HANDOFF.md) | Brand entity (child of Company). Single-page modal for create/edit (NOT a multi-step wizard), card grid leading with the logo, asset lifecycle (stage-then-import on save), soft-delete + boot-purge. | Stable |
| [`COMPANY_MANAGER_HANDOFF.md`](./COMPANY_MANAGER_HANDOFF.md) | Company / Workspace / Organization manager. Two-pane (list + inline editor, no modal), explicit Cancel / Save, dynamic price groups + custom fields, branding section. | Stable |
| [`PRODUCT_LIBRARY_HANDOFF.md`](./PRODUCT_LIBRARY_HANDOFF.md) | Full product catalogue: SQLite schema, CRUD, table + grid views, sidebar filters, pagination, ProductForm modal, Excel/CSV import (3 steps), auto-match images from folder, multi-image handling with paste / reorder / cap. Biggest spec in the folder. | Stable |

---

## When to use which

```
Starting a fresh app?
   ├─→ Read AGENTS.md first.
   ├─→ Then read each *_HANDOFF that matches a feature you want.
   └─→ Build the conventions (sidebar, modal shell, theme, settings) → then features.

Adding a feature to an existing app?
   └─→ Just paste the relevant *_HANDOFF into the project's working directory
       and tell Claude to implement it.

Updating conventions across apps?
   └─→ Edit AGENTS.md here. Don't fork it per-project. Then sync individual
       projects' AGENTS.md from this one when needed.
```

---

## Conventions for editing these docs

- **`AGENTS.md` is the truth.** If a `*_HANDOFF` contradicts it, AGENTS.md wins.
- **Cross-refs over duplication.** When a handoff mirrors something from AGENTS.md, add a small *"Mirrors AGENTS.md §N"* note rather than re-explaining. Keeps the handoff self-contained for paste-into-new-project use, but visible when conventions drift.
- **Stamp last-revised date** at the top of each handoff (`> _Last revised: YYYY-MM-DD. Reference implementation: <app> v<version>._`) so future sessions know how fresh the spec is.
- **Doc changes don't need version bumps** in this folder, but DO bump + rebuild when the implementation changes (see `AGENTS.md §20`).
