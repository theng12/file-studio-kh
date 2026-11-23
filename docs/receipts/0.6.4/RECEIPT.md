# Release receipt — File Studio KH 0.6.4

Tracked copy, sanitised so a stranger can reproduce it from a clean checkout. Paths are `$HOME`- or
repo-relative; values that would need a path are given as hashes; no token, key or owner path appears.
Bulk evidence (gate/build logs, downloaded DMGs) stays untracked.

- app: file (File Studio KH, `kh.filestudio.app`)
- version: 0.6.4 — Sparkle 2 (shared KH shim) self-update baseline
- tag / commit: `0.6.4` = `f86ba18d5b60b8cf20860cc61bcc032017a52b54`; `main` at publish `39c1037`, then
  row-146 cleanup `4a67283`
- artifact: `dist/File Studio KH-0.6.4-arm64.dmg`
- sha256: `f019984fe33a7fb7fd6bb083e82ac3adbcca7b486bfd3b8077493d2f50fdf13f`
- bytes: `144327763`

## Gate

`packaging/gate.sh`: **GATE PASSED**, 11/11 — build (incl. the native addon), headless check suite,
hidden boot/launch check (stayed out of the front, quit cleanly), artifact identity (0.6.4 agrees in
package.json, package-lock.json, CHANGELOG.md).

## Scanner — both pins, each with the identity line it printed

- the gate as it ran: `studio-gate-727408ba92f53258.sh`
  — `tool studio-gate.sh 727408ba92f532581ac21938b1f8a88fa1a4992d6a8e100d1583e7a767e91028`
  — `scan clean export of 6010070f7a0fb445f1d4e3763960e0c84be6787e` — 0 failing
- re-scan on the shipped tool: `$HOME/Developer/_orchestra/tools/pinned/studio-gate-a0b4dc4ca1c1f1ab.sh`
  (13,850 B, sha256 `a0b4dc4ca1c1f1ab65c926f96d024af93ef07dd38e1d959025fd044f9d64d5e7`, = canonical,
  plugin 0.3.295)
  — `tool studio-gate.sh a0b4dc4ca1c1f1ab65c926f96d024af93ef07dd38e1d959025fd044f9d64d5e7`
  — `scan clean export of f86ba18d5b60b8cf20860cc61bcc032017a52b54` — 0 failing (ENTITLEMENT reads
  N/A on the export — the framework is gitignored and lives in `Contents/Frameworks`, so it is proven
  on the built bundle below, not the export).

## DMG scan

`scan-dmg/2026-11-20` (scanner `$HOME/Developer/_orchestra/developer-handoff/kh-mirror-tools/scan-dmg.sh`):
`scan-receipt {"sha256": "f019984fe33a7fb7fd6bb083e82ac3adbcca7b486bfd3b8077493d2f50fdf13f", "exit": 0, "files": 490, "excused": []}`
— OWNER HITS empty apart from the accepted tailnet-range literal; UNKNOWN none; verdict
`scan-dmg: clean`.

## Packaging (measured from the built bundle)

`Sparkle.framework` in `Contents/Frameworks/Sparkle.framework`; `khsparkle.node` in
`Contents/Resources/app.asar.unpacked/dist-electron/`; `Info.plist` carries `SUFeedURL`
(`https://theng12.github.io/file-studio-kh/appcast.xml`), `SUPublicEDKey` (this app's public half),
`KHHoldURL`, `KHHoldTokenFile` (`~/Library/Application Support/file-studio-kh/hold-token`),
`SUEnableAutomaticChecks`; entitlement `com.apple.security.cs.disable-library-validation`;
`codesign --verify --deep --strict` OK; `Authority=KH Studio Local Signing`, `TeamIdentifier=not set`;
`CFBundleShortVersionString = 0.6.4`. Signed with the app's own EdDSA key — private key never in the tree.

## Vendored inputs (identity is the hash + manifest; the shim is not a git repo)

- shim `libkhsparkle.a` sha256 `818826a79d4e54885cbb5ad167f7425da8ba77436c6a5e277532f400aa1b4216`
  (adds `expand_tilde`; row `20261123-95`); inputs manifest
  `f3334b1be7bb4b98af22ac0201c009a6bc0b8f9ac839d158daa984898db38756` (23 files).
- Sparkle `2.10.1` (build 2065) framework binary sha256
  `9c78b2046e763efeb8ca505d63170bc1557651925dbbfd45ac236845732b05a`.

**Reproducibility note (row 160):** `libkhsparkle.a` is now **tracked** at
`vendor/khsparkle/libkhsparkle.a` (from `0b29a49`), so `git ls-tree -r <tag>` proves the build input.
The **0.6.4 tag (`f86ba18`) predates tracking**, so that tag alone cannot reproduce the library —
0.6.5 and later, cut from a commit at/after `0b29a49`, will be fully reproducible. The framework is
tracked-by-pin, not committed (it ships publicly at the sha above).

## Feed readback

- GitHub release `0.6.4` (non-draft), asset `File.Studio.KH-0.6.4-arm64.dmg`: anonymous GET **200**,
  `144327763` B, sha256 matches `f019984f…` above.
- Appcast `https://theng12.github.io/file-studio-kh/appcast.xml`: **200**, item `sparkle:version 0.6.4`,
  `length 144327763`; `scripts/verify-appcast.swift` → **SIGNATURE OK** against the anonymously
  downloaded DMG.

## Not proven

- The live self-update (a version replacing itself). The appcast now names 0.6.4 (the latest), so the
  proof needs 0.6.4 installed with a **real launch** (the shim checks once at start) and a 0.6.5 release
  the installed 0.6.4 updates to — evidence being the installed version reading 0.6.5 **and** a new
  process start time. Until then this is "published and feed-verified", not "has updated itself".
- Per-bundle behavioural assertions (hold taken on File's own bundle) run on that same first launch.
