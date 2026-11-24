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

## Screenshots (§5d) — captured from this artifact, after the tag (docs-only)

`check-app-screenshots.sh 7a035b7b380c` on the repo reports:
`PASS: 3 screenshots, each within size, named, referenced, and clean in text and metadata`, **rc=0**.

- `docs/screenshots/dashboard-light.png` (218 KB), `files-light.png` (327 KB), `settings-dark.png` (299 KB),
  each referenced from `README.md`. They were missing when the tag was cut, so they landed after it: a
  docs-only change, the published binary is untouched.
- Taken from **this released artifact** — the `0.6.6` DMG (sha `fc4c129f…`) mounted read-only, the bundle
  copied out and `codesign -v` checked, launched with `--test-mode` (window never shown, no Dock icon) and a
  throwaway `FSKH_TEST_DATA_DIR`, driven over the DevTools protocol. No pointer, no keystroke, nothing on
  the owner's desktop. The demo library is a throwaway 600 MB disk image at `/Volumes/Studio Archive` with
  invented file names, and the Settings save path was pointed inside it, so no real path is in any picture.

**Finding, not fixed in this artifact:** in the **Files list view** the `PREVIEW` and `FILENAME` headers
overlap (`PREVIEWFILENAME`) at every window width — the Preview column is a fixed `w-16` (64 px) and its
uppercase, tracked label does not fit. The Files shot above therefore uses **Grid** view. The fix is one
class (`w-16` → `w-24` on that `<th>`), which needs a build: it belongs to the next version.

## Not proven

- The Sparkle self-update loop itself (a version replacing itself live). The appcast now names 0.6.6; the
  proof needs 0.6.6 installed with a real launch and a later release it updates to. Until then this is
  "published and feed-verified", not "has updated itself".
