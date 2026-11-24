# Release receipt — File Studio KH 0.6.7

Tracked copy, sanitised so a stranger can reproduce it from a clean checkout. Paths are `$HOME`- or
repo-relative; no token, key or owner path appears here.

- app: file (File Studio KH, `kh.filestudio.app`)
- version: 0.6.7 — **Files list column-collision fix** (closes the 0.6.6 preview/filename overlap defect and proves the `screenshots` gate step inside the canonical runner)
- tag / commit: `0.6.7` = `d7886e4412ee2ce0e10f5e0bfacbdb493bbad0e0`; appcast commit `8499804` on `main` after it
- artifact: `dist/File Studio KH-0.6.7-arm64.dmg`
- sha256: `9452739b7308f9b894c817090a9782179d9e118708d6ba5ee7b7b31f382a0569`
- bytes: `145235758`

## Provenance (plainly)

**The artifact was built from `d7886e4` and the head at tag `0.6.7` is `d7886e4`.** Same commit; no inference.
All three §5d screenshots were captured and committed in `d7886e4` **before** the gate ran and before tag `0.6.7`
was cut. Publish only these bytes: sha `9452739b…`. A different file is a new artifact and needs its own gate.

## Gate

`gate-run.sh` (canonical, **sha `f05b010c16e5`**) with `lead/gate-0.6.7.conf`:
**`GATE PASS file d7886e4412ee2ce0e10f5e0bfacbdb493bbad0e0 2026-11-24T15:26:39Z`**, evidence
`lead/gate-20261124-221229-50724` (52 KB).

Steps (all passed inside the runner): `compile` (`npm run build`) ok · `gate` (`packaging/gate.sh`) ok ·
`package` (`packaging/build-dmg.sh`) ok · `launch-dmg` ok · `screenshots` ok · `idle-launch` ok ·
`desktop-safety` ok · `commit-identity` ok · `idle-footprint` ok · `scan-dmg` ok.

- **Launch (shipped DMG):**
  `tool: install-launch-check.sh 847e77db5c99 at $HOME/Developer/_orchestra/tools/pinned/install-launch-check-847e77db5c99d5d6.sh`
  → `PASS: File Studio KH.app 0.6.7 launched hidden and is alive after 10s (pid 81060; kh.filestudio.app)`.
- **Idle footprint (built-in runner step on shipped DMG via `IDLE_PID`):**
  `idle footprint: pid 82981 = 145 MB after 10s, -3 MB while idle (ceiling 512 MB)` → `OK`.
- **Screenshots (§5d, proven as a real gate step inside the runner before tagging):**
  `tool: check-app-screenshots.sh 7a035b7b380c at $HOME/Developer/_orchestra/tools/check-app-screenshots.sh`
  → `PASS: 3 screenshots, each within size, named, referenced, and clean in text and metadata` (`screenshots rc=0`).
- **DMG scan:** `scan-dmg/2026-11-20` over `dist/File Studio KH-0.6.7-arm64.dmg` (`sha256: 9452739b…`) →
  `scan-dmg: clean` (490 files, exit `0`, 0 owner hits, 0 unknown, `excused: []`).
- **Studio gate scanner:** `studio-gate.sh 17ff93c69376d391` on clean export of `d7886e4412ee` →
  `0 failing check(s)` (`rc=0`). Notes: `SHIM PASS` on `accepted-previous` (adopt the current shim in 0.6.8);
  `ROWESCAPE AUDIT` (no state literals found); `ENTITLEMENT UNMEASURED` on clean export (checked in packaged bundle).

## What a user sees differently

- **Files list columns no longer collide.** The Preview header now has enough width (`w-24`, 96 px) for its
  tracked uppercase label, and the list table keeps a minimum width so the Filename column stays visible and
  readable instead of colliding with or collapsing behind its neighbors on standard window sizes.

## Screenshots (§5d) — captured before tag, verified in gate

- `docs/screenshots/dashboard-light.png` (215 KB)
- `docs/screenshots/files-light.png` (315 KB) — **List view** proof (`Preview` 96 px, `Filename` 236 px, no overlap)
- `docs/screenshots/settings-dark.png` (300 KB)

All three are referenced from `README.md` and passed `check-app-screenshots.sh 7a035b7b380c` (`rc=0`) inside the
canonical gate before tagging. Captured from the built `0.6.7` app in `--test-mode` (window never shown, no Dock
icon) with a throwaway `FSKH_TEST_DATA_DIR` and invented demo filenames on a throwaway volume at
`/Volumes/Studio Archive`.

## Held and unchanged

- The update-hold token remains File's own 0600 / 64-hex file (`KHHoldTokenFile` →
  `~/Library/Application Support/file-studio-kh/hold-token`), unchanged since 0.6.3.
- Local `dist/` retains exactly two verified DMGs: `File Studio KH-0.6.7-arm64.dmg` (current) and
  `File Studio KH-0.6.6-arm64.dmg` (previous). No `_trash` symlink exists in the checkout.

## Feed readback

- GitHub release `0.6.7` (`https://github.com/theng12/file-studio-kh/releases/tag/0.6.7`), asset
  `File.Studio.KH-0.6.7-arm64.dmg`: anonymous GET HTTP `200`, `145235758` B,
  `sha256=9452739b7308f9b894c817090a9782179d9e118708d6ba5ee7b7b31f382a0569` (exact match to gated local DMG and
  GitHub asset digest).
- GitHub Pages deploy run `45474142094` (from `main` `8499804`): `success`.
- Live appcast `https://theng12.github.io/file-studio-kh/appcast.xml`: `sparkle:shortVersionString` = `0.6.7`,
  `sparkle:version` = `0.6.7`, `length="145235758"`.
- Signature check: `scripts/verify-appcast.swift` over the anonymously downloaded DMG against the app's pinned
  `SUPublicEDKey` (fingerprint `b5e2d4f1deef0573`) and the live-served `sparkle:edSignature` → **`SIGNATURE OK`**.

## Owner rule & publish approval

Published under the owner's standing rule:

> "publish it then. also stop waiting for me confirmation each time. i've already set up a rule that says
> publish upon green"

and explicitly confirmed by the user (`Publish 0.6.7 now`) when auto-mode held the public repository push.

## Evidence & local footprint

- Gate evidence kept at `lead/gate-20261124-221229-50724` (52 KB, cited above).
- No extra worktrees created for 0.6.7; nothing moved to `~/Desktop/_trash` (0 B moved).

## Not proven / UNMEASURED

- Live Sparkle self-update loop (0.6.6 installing 0.6.7 unattended via Launcher/Sparkle) — `UNMEASURED` until a
  real machine runs the update; this receipt proves "published and feed-verified".
- Long-run multi-job idle soak (hundreds of scans/transfers) — `UNMEASURED` (single-launch 10 s idle settle
  measured at 145 MB, −3 MB).
- Current `libkhsparkle.a` shim upgrade — `studio-gate` passed on `accepted-previous`; upgrade scheduled for 0.6.8.
