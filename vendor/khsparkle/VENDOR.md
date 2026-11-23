# Vendored Sparkle inputs — File Studio KH (intended for §3C, Electron)

These inputs are **not committed** (`../../.gitignore`); fetch/pin them where the key holder builds.
`scripts/build-khsparkle.mjs` needs `vendor/khsparkle/libkhsparkle.a`, `vendor/khsparkle/khsparkle.h`
(this file's folder) and `vendor/Sparkle.framework`.

- **Shim static library** `libkhsparkle.a` — the shared, accepted shim:
  `/Users/vengtheng/Developer/_orchestra/developer-system/sparkle-shim-20261123/dist/libkhsparkle.a`,
  sha256 `62ca951049daf27ea60dec7cf468a079ef00adf1f00f17b2fef8853318db870e` (universal arm64+x86_64).
  `khsparkle.h` is the shim's `include/khsparkle.h`.
- **Sparkle framework** `2.10.1` (build 2065):
  `https://github.com/sparkle-project/Sparkle/releases/download/2.10.1/Sparkle-2.10.1.tar.xz`,
  archive sha256 `1a856d2a9edb8e628de88121d7be04cf0e2167f8641650b78fca00b14244cf27`; framework binary
  sha256 `9c78b2046e7637efeb8ca505d63170bc1557651925dbbfd45ac236845732b05a`. Ships `Versions/B` with
  `Versions/Current -> B` (no `Versions/A`).

## Known blocker before this can ship

`khsparkle.m` `read_hold_token()` reads `KHHoldTokenFile` verbatim and does **not** expand `~`.
A `~/…` plist value reads NIL and the shim refuses every update. Point `KHHoldTokenFile` at an
absolute path, or wait for the shim to expand `~`. See `../../../lead/SPARKLE-INTEGRATION-STATE.md`.
