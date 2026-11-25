# Release receipt — File Studio KH 0.6.8

A stranger can reproduce this from a clean checkout. Paths are `$HOME`- or repo-relative; no token, key
or owner path appears here.

app: file — File Studio KH, `kh.filestudio.app`
version: 0.6.8
commit: dea7d97e2a5269f7797b8cea0805f8457a9b6779 (gated head; tag `0.6.8` is annotated `6753d179…` and peels to this commit)
artifact: `$HOME/Developer/_orchestra/developer-utilities/file-studio-kh/app/dist/File Studio KH-0.6.8-arm64.dmg`
sha256: 9be2c44c20ba7fa2b9a3b9429cef3562b55f22aa6013fa40cbc9c0c3d385a650
bytes: 145093829
scan: sha256=9be2c44c20ba7fa2b9a3b9429cef3562b55f22aa6013fa40cbc9c0c3d385a650 clean — scan-dmg/2026-11-20, exit 0, 490 files, `excused: []`
gate config: `$HOME/Developer/_orchestra/tools/gate-configs/file-0.6.8.sh`
gate exit: 0 — `GATE PASS file dea7d97e2a5269f7797b8cea0805f8457a9b6779 2026-11-25T15:10:33Z`
feed readback: PENDING — estate `file-studio` row still served 0.6.7 at 15:52Z; S001's next feed pass carries it
page state: same — `https://theng12.github.io/file-studio-kh/appcast.xml` serves `0.6.8` with `length="145093829"` and the 0.6.8 enclosure; the estate feed page does not carry 0.6.8 yet
dirty: false
retired: 0.6.6 DMG (138 MB), two superseded 0.6.8 build attempts (238 MB), the orphan 0.6.6 blockmap, each with a MANIFEST.md in `~/Desktop/_trash/file-studio-kh/`
not proven: live Sparkle self-update loop (0.6.7 → 0.6.8 unattended) — UNMEASURED; long-run multi-job idle soak — UNMEASURED; install on a second Mac — UNMEASURED (the Launcher installs on the owner's automatic setting); physical/owner-observation — not exercised.

## What changed

- The vendored `vendor/khsparkle/libkhsparkle.a` is now the current pinned shim
  `2bce760e7749a0f21dfa378c53c391d039401355012e774a81b691043a3cb17f` (86,632 bytes), replacing the
  accepted-previous `818826a7…`; `VENDOR.md` names that sha and the bytes agree.
- `packaging/build-dmg.sh` and `packaging/gate.sh` export `/opt/homebrew/bin` (row `20261122-318`), and
  `build-dmg.sh` detaches a killed earlier build's leftover image of the same DMG before writing (row
  `20261123-153`) — that fault killed the first attempt at this release.
- No behaviour change in the app.

## Gate

Runner `gate-run.sh 528de9fe53d0` (`sha256 528de9fe53d0c0de552d30dca1b21092b073a24fac76daf53e21da738b3b6f46`),
evidence `lead/gate-20261125-215155-80661` (52 KB). Steps, all passed inside the runner: `compile`,
`gate` (`packaging/gate.sh`), `package`, `launch-dmg`, `screenshots`, `idle-launch`, `desktop-safety`,
`commit-identity`, `idle-footprint`, `scan-dmg`.

- Launch (shipped DMG, hidden): `PASS: File Studio KH.app 0.6.8 launched hidden and is alive after 10s (pid 88456; kh.filestudio.app)`.
- Idle footprint: `pid 89353 = 168 MB after 10s, +0 MB while idle (ceiling 512 MB)` → `OK`.
- Screenshots (§5d): `check-app-screenshots.sh 7a035b7b380c` → `PASS: 3 screenshots, each within size, named, referenced, and clean in text and metadata`; captured hidden from the 0.6.8 DMG on a throwaway volume with invented names, committed in `dea7d97` before the gate.
- DMG scan: `scan-dmg: clean`, 490 files, `excused: []`.
- Studio gate scanner (`studio-gate-e9ca610dac55c337`, run under **bash**): `0 failing check(s)`, `SHIM PASS … current`,
  `HOMEPATH PASS`, `RETIREDHOST PASS`, `ROWESCAPE AUDIT` (no state literals — by-hand enumeration unchanged from 0.6.7).
  Under zsh the same tree reports a false `SHIM FAIL` (issue row `20261125-57`).

## Publish and feed

- Release `0.6.8`: https://github.com/theng12/file-studio-kh/releases/tag/0.6.8, asset
  `File.Studio.KH-0.6.8-arm64.dmg`. Anonymous GET HTTP `200`, **145,093,829 B**,
  sha256 `9be2c44c20ba7fa2b9a3b9429cef3562b55f22aa6013fa40cbc9c0c3d385a650` — exact match to the gated local file.
- Tag ref at `0.6.8` carries the six-field `app-meta.json` (`name`, `bundle_id`, `type`=utility, `tagline`,
  `description`, `localFile`), read back through the GitHub contents API at that ref.
- Appcast: `docs/appcast.xml` generated from the published bytes; Ed25519 signature verified
  (`verify-appcast.swift` → `SIGNATURE OK`) both locally and over the anonymously downloaded DMG against the
  **served** appcast. Pages: two push-triggered runs failed with "Found 0 artifact(s)" (issue row
  `20261125-56`); a `workflow_dispatch` run succeeded and the served appcast now offers 0.6.8 with its enclosure.
- Estate feed row: `file-studio 0.6.7` as of 15:52Z. S001 verified the asset and hold fields and will carry
  0.6.8 in its next pass; this receipt's `feed readback` line stays PENDING until that pass commits and
  `feed-verify.sh file-studio --expect-version 0.6.8 --expect-sha 9be2c44c… --public-key …` passes.

## Local artifacts

`dist/` holds exactly two installed versions — 0.6.8 (current) and 0.6.7 (previous), each with its blockmap.
Retired recoverably with manifests, nothing deleted: 0.6.6 DMG, two superseded 0.6.8 build attempts, and the
orphan 0.6.6 blockmap (376 MB total; the disk gains that when the owner empties the trash).
Local gate evidence kept: 11 directories, 668 KB.

## Not proven

- Live Sparkle self-update loop — UNMEASURED: no real Mac has installed 0.6.8 from 0.6.7 unattended.
- Long-run multi-job idle soak (hundreds of scans) — UNMEASURED; the three-state ceiling is met only in the
  single-launch 10 s state above (168 MB, flat).
- Install on a second machine and any physical/owner observation — not exercised: installing is the Launcher's
  job on the owner's automatic setting.
- Whole-kit/fleet-run state and the post-long-run state — UNMEASURED for this release.

## Evidence

- gate log and summary: `lead/gate-run-068.log`, `lead/gate-20261125-215155-80661/summary.txt`
- asset readback: `lead/0.6.8/evidence/asset-readback.txt`, served appcast `lead/0.6.8/evidence/served-appcast.xml`
- runner line: `lead/0.6.8/evidence/runner.txt`

Skills used: ponytail (invoked) · graphify queries: `_graphs/file` (76 nodes; vendored shim inputs, packaging, appcast scripts) · release-closeout · app-test-lock
