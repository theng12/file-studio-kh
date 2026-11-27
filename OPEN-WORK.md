# Open work — file-studio-kh

What this app still owes, newest first. Open items only: shipped work lives in `CHANGELOG.md` and
`docs/receipts/<version>/RECEIPT.md`.

- [ ] **A live self-update, seen happening** — `UNMEASURED`: no Mac has installed a new version from the previous one unattended. The bytes, the appcast signature and the feed row are all proven; the loop itself is not. **Next:** let one version install itself on a machine that is left alone, and record the before/after version readback.
- [ ] **A long-run soak** — `UNMEASURED` for the post-long-run state: hundreds of scans in a row, then compare ports, fds, threads and footprint. The three-state memory ceiling is met only in the idle state so far. **Next:** run a multi-hundred-scan pass against a copied folder tree and record the four numbers before and after.
- [ ] **An install on a second Mac** — installing is the Launcher's job on the owner's automatic setting, so this is not release work, but no second machine has been seen running it. **Next:** record the installed-version readback on the next machine the Launcher updates.
- [ ] **Scanning on very large folders** — manual testing may show the main process feeling busy while it scans. **Next:** measure a scan of a folder tree in the hundreds of thousands of files, and move scanning to a worker only if the measurement says the UI is blocked.
- [ ] **Duplicate and similar-file detection** — the next product step after QA hardening, deliberately not started until the V1 copy workflow is trusted on real folder trees. **Next:** agree the detection rules with the owner before any code, then build it against a copied fixture tree.

Every scan and copy path in this app writes to a copy the person chose; nothing here is about editing
originals, and no open item changes that.
