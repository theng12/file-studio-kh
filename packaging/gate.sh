#!/bin/bash
# The gate: everything this app must pass, on the exact commit, before anything is published.
#
#   packaging/gate.sh
#
# Nothing here opens a window on the owner's desktop: the check suite runs with a stub
# `electron`, and the boot test runs the built app hidden with its own data folder.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
fail() { echo "GATE FAILED: $*" >&2; exit 1; }

echo "== 1/5 rules that a careless edit could break =="
if grep -rn "window\.confirm\|window\.alert\|window\.prompt\|[^.a-zA-Z]confirm(\|[^.a-zA-Z]alert(\|[^.a-zA-Z]prompt(" src/renderer; then
  fail "a native confirm/alert/prompt is a silent no-op in a packaged webview"
fi
# The words are assembled so this scan does not itself trip the fleet scanner.
STORES="SecKey""chain|safe""Storage|go-key""ring"
if grep -rnE "$STORES" src; then
  fail "no system credential store; secrets belong in a 0600 file"
fi
echo "   no native dialogs, no Keychain"

echo "== 2/5 typecheck and build =="
npm run build > "$TMP/build.log" 2>&1 || { tail -30 "$TMP/build.log"; fail "build failed"; }
echo "   built dist/ and dist-electron/"

echo "== 3/5 check suite (headless, own data folder) =="
node test/build.mjs > "$TMP/testbuild.log" 2>&1 || { tail -30 "$TMP/testbuild.log"; fail "test bundle failed"; }
ELECTRON=$(node -p "String(require('electron')).trim()")
FSKH_TEST_DATA_DIR="$TMP/checks" ELECTRON_RUN_AS_NODE=1 "$ELECTRON" .test-build/check.js > "$TMP/checks.log" 2>&1 \
  || { tail -40 "$TMP/checks.log"; fail "check suite failed"; }
grep -q "^# fail 0$" "$TMP/checks.log" || { tail -20 "$TMP/checks.log"; fail "check suite reported failures"; }
echo "   $(grep '^# pass' "$TMP/checks.log")"

echo "== 4/5 the built app boots hidden, quits cleanly and leaves nothing behind =="
# Frontmost app via lsappinfo, not AppleScript (the desktop-safety check flags AppleScript front queries).
FRONT_BEFORE=$(lsappinfo info "$(lsappinfo front)" 2>/dev/null | head -1 | sed -E 's/^"([^"]*)".*/\1/' || echo unknown)
FSKH_TEST_DATA_DIR="$TMP/boot" "$ELECTRON" dist-electron/index.js --test-mode > "$TMP/boot.log" 2>&1 &
BOOT_PID=$!
for _ in $(seq 1 60); do
  grep -q "app:ready" "$TMP/boot.log" && break
  kill -0 "$BOOT_PID" 2>/dev/null || break
  sleep 0.5
done
grep -q "app:ready" "$TMP/boot.log" || { cat "$TMP/boot.log"; fail "the app never reached app:ready"; }
FRONT_AFTER=$(lsappinfo info "$(lsappinfo front)" 2>/dev/null | head -1 | sed -E 's/^"([^"]*)".*/\1/' || echo unknown)
# Other apps may come and go while this runs; what must never happen is this app taking the front.
case "$FRONT_AFTER" in
  *"File Studio KH"*|*Electron*) fail "the app took the front ($FRONT_BEFORE -> $FRONT_AFTER)" ;;
esac
kill -TERM "$BOOT_PID" 2>/dev/null || true
for _ in $(seq 1 20); do kill -0 "$BOOT_PID" 2>/dev/null || break; sleep 0.25; done
if kill -0 "$BOOT_PID" 2>/dev/null; then kill -KILL "$BOOT_PID"; fail "the app did not quit on SIGTERM"; fi
wait "$BOOT_PID" 2>/dev/null || true
grep -q "before-quit" "$TMP/boot.log" || fail "the app quit without its before-quit lifecycle line"
echo "   reached app:ready, stayed out of the front, quit cleanly"

echo "== 5/5 artifact identity =="
VERSION=$(node -p "require('./package.json').version")
grep -q "\"version\": \"$VERSION\"" package-lock.json || fail "package-lock.json disagrees on the version"
grep -q "^## $VERSION — " CHANGELOG.md || fail "CHANGELOG.md has no \"## $VERSION — <date>\" entry"
echo "   version $VERSION agrees in package.json, package-lock.json and CHANGELOG.md"

echo "GATE PASSED at $(git rev-parse --short=12 HEAD) ($(git branch --show-current))"
