# Release receipt — File Studio KH 0.6.6

Tracked copy, sanitised so a stranger can reproduce it from a clean checkout. Paths are `$HOME`- or
repo-relative; no token, key or owner path appears here.

- app: file (File Studio KH, `kh.filestudio.app`)
- version: 0.6.6 — **house design-standards pass** (presentation only; no change to what the app does)
- tag / commit: `0.6.6` = `52c34523e287f83dc278d232cd57198f826f7e7f`; appcast commit on `main` after it
- artifact: `dist/File Studio KH-0.6.6-arm64.dmg`
- sha256: `fc4c129f99ac38f2097445f6645dc00b71a3add239e923bc79c44b13118d4133`
- bytes: `144960883`

## Provenance (plainly — Main's condition 1)

**The artifact was built from `52c3452` and the head is `52c3452`.** Same commit; no inference. The DMG's
own `app.asar` carries the 0.6.6 text, and `git show 0.6.6:CHANGELOG.md` matches the built bundle. Publish
only these bytes: this sha, `fc4c129f…`. A different file is a new artifact and needs its own gate.

## Gate

`gate-run.sh` (canonical, **sha `f05b010c16e57798`**, 43,672 B) with `lead/gate-0.6.6.conf`:
**GATE PASS file `52c34523e287` 2026-11-24T10:26:10Z**, evidence `lead/gate-20261124-165056-4493`.
Steps: `gate` ok · `launch-dmg` ok · `idle` ok · `desktop-safety` ok · `commit-identity` ok.
(The runner's built-in `idle-footprint` step is `UNMEASURED` — it wants a pre-set `IDLE_PID`; the measured
number below comes from the dedicated `idle` step, which launches the shipped DMG.)

- **Launch (shipped DMG):** `tool: install-launch-check.sh 847e77db5c99 at …/pinned/install-launch-check-847e77db5c99d5d6.sh`
  → `PASS: File Studio KH.app 0.6.6 launched hidden and is alive after 10s (pid 47244; kh.filestudio.app)`.
- **Idle footprint (measured from the shipped DMG):** `pid 47566 = 160 MB after 10s, −3 MB while idle
  (ceiling 512 MB)` → OK. Named, not borrowed.

## What a user sees differently

- The app now **follows the Mac's appearance** (System) by default instead of forcing Light; an explicit
  Light or Dark choice is kept. (Legacy `default`/invalid reads as System.)
- The **version is a pill** at the bottom of the sidebar that opens What's New — now real bullets with a
  **Done** button, not raw text.
- The **Files list speaks plainly**: "Not scanned yet" before a folder is chosen; "Needs review" /
  "Trash candidate" instead of raw codes; "Scan ID" instead of a batch hash; empty/error messages that say
  what to do; a neutral view-toggle so the action button stands out; labelled filters.
- **⌘,** opens Settings. Toasts announce politely to screen readers.
- Internal: shared layout tokens (spacing/radius/type/sidebar/neutral ramp) defined once.

## Held and unchanged

- The update-hold token is File's own 0600 / 64-hex file (`KHHoldTokenFile` →
  `~/Library/Application Support/file-studio-kh/hold-token`), unchanged since 0.6.3; `migrateLegacyToken`
  copies and leaves the shared `~/Library/KHUpdater/state/hold-token` for Displays.

## Feed readback

- GitHub release `0.6.6`, asset `File.Studio.KH-0.6.6-arm64.dmg`: anonymous GET 200, `144960883` B,
  sha256 `fc4c129f…` (== GitHub's own digest).
- Appcast `https://theng12.github.io/file-studio-kh/appcast.xml`: item `0.6.6`, length `144960883`;
  `scripts/verify-appcast.swift` over the anonymously downloaded DMG → **SIGNATURE OK**.

## Owner rule this release was published under

> "publish it then. also stop waiting for me confirmation each time. i've already set up a rule that says
> publish upon green"

## Screenshots (§5d) — NOT captured (a finding, stated plainly)

`check-app-screenshots.sh 7a035b7b380c` on the repo reports:
`MISSING: no docs/screenshots/ — 3–4 images of the main screen, the one flow the app exists for, and
Settings only if it carries a real decision`, **rc=1**. So 0.6.6 published on the green gate and the
owner's publish-upon-green rule, but **without the §5d screenshots**. They are owed and will be captured
from this 0.6.6 DMG (hidden instance / `--test-mode`, throwaway data dir, invented demo file names) and
committed to `docs/screenshots/` + README — a docs-only change; the shipped binary is unchanged. Recorded
here rather than left silent, because a missing screenshot is a finding, not a note.

## Not proven

- The Sparkle self-update loop itself (a version replacing itself live). The appcast now names 0.6.6; the
  proof needs 0.6.6 installed with a real launch and a later release it updates to. Until then this is
  "published and feed-verified", not "has updated itself".
