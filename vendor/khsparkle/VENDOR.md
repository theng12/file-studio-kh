# Vendored Sparkle inputs — File Studio KH (intended for §3C, Electron)

These inputs are **not committed** (`../../.gitignore`); fetch/pin them where the key holder builds.
`scripts/build-khsparkle.mjs` needs `vendor/khsparkle/libkhsparkle.a`, `vendor/khsparkle/khsparkle.h`
(this file's folder) and `vendor/khsparkle/Sparkle.framework`.

- **Shim static library** `libkhsparkle.a` — the shared, accepted shim:
  `$HOME/Developer/_orchestra/developer-system/sparkle-shim-20261123/dist/libkhsparkle.a`,
  sha256 `818826a79d4e54885cbb5ad167f7425da8ba77436c6a5e277532f400aa1b4216` (universal arm64+x86_64;
  rebuilt 2026-11-23 with `expand_tilde` so `KHHoldTokenFile` may use `~/…` — row `20261123-95`).
  `khsparkle.h` is the shim's `include/khsparkle.h`.
- **Sparkle framework** `2.10.1` (build 2065):
  `https://github.com/sparkle-project/Sparkle/releases/download/2.10.1/Sparkle-2.10.1.tar.xz`,
  archive sha256 `1a856d2a9edb8e628de88121d7be04cf0e2167f8641650b78fca00b14244cf27`; framework binary
  sha256 `9c78b2046e7637efeb8ca505d63170bc1557651925dbbfd45ac236845732b05a`. Ships `Versions/B` with
  `Versions/Current -> B` (no `Versions/A`).

## Resolved

`read_hold_token()` used to read `KHHoldTokenFile` verbatim and not expand `~`, so a `~/…` plist
value read NIL and the shim refused every update (rows `20261123-95`). The rebuilt library above
adds `expand_tilde`, so `KHHoldTokenFile = ~/Library/Application Support/…` now resolves.
