# Release receipt — File Studio KH 0.6.5

Tracked copy, sanitised so a stranger can reproduce it from a clean checkout. Paths are `$HOME`- or
repo-relative; values that would need a path are given as hashes; no token, key or owner path appears.
Bulk evidence (gate/build logs, downloaded DMGs) stays untracked.

- app: file (File Studio KH, `kh.filestudio.app`)
- version: 0.6.5 — **the real user-facing change is the launch fix**: 0.6.4 quit ~1 s after launch
  (V8 SIGTRAP) because its custom entitlements dropped `allow-jit`; 0.6.5 restores the Electron runtime
  entitlements (JIT + unsigned-executable-memory + library-validation). Plus the Sparkle baseline.
- tag / commit: `0.6.5` = `9ad3bf041269871ae677efba6c9b7d8e8e36baf0`; appcast commit `87f475b` on
  `main`; `main` at publish `87f475b`
- artifact: `dist/File Studio KH-0.6.5-arm64.dmg`
- sha256: `9c3403a40a62d8b839a4f0cd915577bc4334e20d60170235f39e13d444f5bb3d`
- bytes: `145365632`

## Gate

`packaging/gate.sh` via the lane wrapper: **GATE PASSED**, all 5 sections — rules, typecheck+build,
headless check suite, hidden boot/launch (stayed out of the front, quit cleanly), artifact identity
(0.6.5 agrees in package.json, package-lock.json, CHANGELOG.md). Gated commit `9ad3bf04`.

## Launch check (the fix, proven on the DMG)

`install-launch-check-e1a4850e0c342d3e.sh` on the DMG: **PASS — "File Studio KH.app 0.6.5 launched
hidden and is alive after 10s (pid 12357; kh.filestudio.app)"**, no crash report. Independently repeated
by Developer - Utilities (U001): **PASS** on the same sha (pid 23826). Two instruments, one artifact.

## Entitlements inside the gated DMG (`codesign -d --entitlements :-`)

`com.apple.security.cs.allow-jit` **present**, `com.apple.security.cs.allow-unsigned-executable-memory`
**present**, `com.apple.security.cs.disable-library-validation` **present**; `CFBundleShortVersionString
0.6.5`; `SUFeedURL https://theng12.github.io/file-studio-kh/appcast.xml`; signed `KH Studio Local
Signing`, `TeamIdentifier=not set`.

## Vendored inputs

- shim `libkhsparkle.a` sha256 `818826a79d4e54885cbb5ad167f7425da8ba77436c6a5e277532f400aa1b4216` — **matches** `REQUIRED-SHIM.txt`;
  inputs manifest `f3334b1be7bb4b98af22ac0201c009a6bc0b8f9ac839d158daa984898db38756` (23 files). Tracked
  at `vendor/khsparkle/libkhsparkle.a` since `0b29a49`, so `git ls-tree -r 0.6.5` proves the input.
- Sparkle `2.10.1` (build 2065) framework binary sha256
  `9c78b2046e763efeb8ca505d63170bc1557651925dbbfd45ac236845732b05a` (tracked-by-pin, not committed).

## Scans

- Pinned source scanner `studio-gate` pin `76dbf7aa09f5109bee4bb97705a0af3d1737e0b87230270c2f1bd3c779235ae9`:
  `scan clean export of 9ad3bf041269871ae677efba6c9b7d8e8e36baf0`, SHIM PASS, **0 failing**.
- Artifact scan `scan-dmg/2026-11-20` on the DMG:
  `scan-receipt {"sha256": "9c3403a40a62d8b839a4f0cd915577bc4334e20d60170235f39e13d444f5bb3d", "exit": 0,
  "files": 490, "excused": []}` — owner hits empty apart from the accepted tailnet-range literal;
  UNKNOWN none; verdict clean.

## Feed readback

- GitHub release `0.6.5` (non-draft), asset `File.Studio.KH-0.6.5-arm64.dmg`: anonymous GET **200**,
  `145365632` B, sha256 matches `9c3403a4…` (also equal to GitHub's own `digest`).
- Appcast `https://theng12.github.io/file-studio-kh/appcast.xml`: **200**, item `sparkle:version 0.6.5`,
  `length 145365632`; `scripts/verify-appcast.swift` over the **anonymously downloaded** DMG →
  **SIGNATURE OK**.

## 0.6.4 disposition

**Fix-forward, not a retraction.** 0.6.4's GitHub release **stays published**; what moves is the
**card**, because the feed producer projects `releases/latest`, which now resolves to 0.6.5. 0.6.4
crashes on launch and was never auto-installed by anyone: the self-update engine arrives only *with*
0.6.4, so 0.6.3 and earlier carry no shim and no `SUFeedURL` and were not listening. The 0.6.4 release
**body** is additionally edited to "superseded / do not install" so a person arriving from an old link
does not read a body that looks current. The 0.6.4 DMG is kept as restorable evidence (the crash
artifact).

## Lane record

File's build-run acquired the light lane at **16:11:41Z** (light 2000 MB, short, file-lead-001) and
released it cleanly after the build (`released light (file)`; `status` then showed no `file` entry in
`held` or `waiting:`). Machine at acquisition: 10.7 GB available, swap 77% — under the 90% refusal, so
admissible, not an environmental failure. Release Tooling note: an older start stamp `14:28:55Z` was
visible earlier for the same hold (same holder-pid 12192) before it read `16:11:41Z` — one hold showing
two start times is theirs to note; no leaked duplicate existed (measured, exactly one `file` entry).

## Not proven

- The Sparkle self-update loop itself (a version replacing itself). The appcast now names 0.6.5, so the
  proof needs 0.6.5 installed with a **real launch** and a later release it updates to; evidence would be
  the installed version reading the newer one **and** a new process start time. Until then this is
  "published and feed-verified", not "has updated itself".
