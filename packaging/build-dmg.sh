#!/usr/bin/env bash
# Builds the DMG this app ships from: signed, verified, leak-scanned, and kept beside
# the previous one. Publishing is a separate step (the canonical release-push.sh in update-studio-kh).
set -euo pipefail
cd "$(dirname "$0")/.."
unset ELECTRON_RUN_AS_NODE
VERSION="$(node -p "require('./package.json').version")"
APP="dist/mac-arm64/File Studio KH.app"
STAGE="$(mktemp -d -t file-studio-dmg)"
trap 'rm -rf "$STAGE"' EXIT

npm run build
rm -rf dist/mac-arm64
./node_modules/.bin/electron-builder --mac dmg --arm64 --publish never

test -d "$APP" || { echo "no app bundle at $APP" >&2; exit 1; }
codesign --verify --deep --strict "$APP"
codesign -dvv "$APP" 2>&1 | grep -x 'Authority=KH Studio Local Signing' >/dev/null \
  || { echo "app is not signed by KH Studio Local Signing" >&2; exit 1; }
test "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Contents/Info.plist")" = 'kh.filestudio.app'
test "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Contents/Info.plist")" = "$VERSION"

ditto "$APP" "$STAGE/File Studio KH.app"
ln -s /Applications "$STAGE/Applications"
DMG="dist/File Studio KH-$VERSION-arm64.dmg"
# A superseded build of the same version rotates aside instead of being overwritten.
if [ -e "$DMG" ]; then
  ROTATE="$HOME/Desktop/_trash/file-studio-kh/$(date +%Y-%m-%d) superseded"
  mkdir -p "$ROTATE"
  mv "$DMG" "$ROTATE/$(basename "$DMG" .dmg) $(date +%H-%M-%S).dmg"
fi
hdiutil create -volname "File Studio KH $VERSION" -srcfolder "$STAGE" -format UDZO "$DMG"
codesign --sign - "$DMG"
codesign --verify --strict "$DMG"
hdiutil verify "$DMG"

# The packaged app must actually launch. The gate's boot runs dev Electron and cannot see this:
# 0.6.4 died in V8 ~1s after launch on a green gate (rows 20261123-170/171). Blocking.
LAUNCH_CHECK="${KH_LAUNCH_CHECK:-/Users/vengtheng/Developer/_orchestra/tools/pinned/install-launch-check-e1a4850e0c342d3e.sh}"
[ -x "$LAUNCH_CHECK" ] || { echo "launch check missing at $LAUNCH_CHECK (set KH_LAUNCH_CHECK)" >&2; exit 1; }
bash "$LAUNCH_CHECK" "$DMG" "File Studio KH" \
  || { echo "the packaged app did not launch (install-launch-check) — refusing to keep this DMG" >&2; exit 1; }

# All KH apps are public: no key, token, owner email or network address inside the artifact.
MOUNT=$(mktemp -d -t file-studio-mount)
hdiutil attach "$DMG" -mountpoint "$MOUNT" -nobrowse -readonly >/dev/null
LEAK=$(grep -rIl -E 'sk-[A-Za-z0-9]{20}|BEGIN (OPENSSH|RSA) PRIVATE KEY|112568204@|100\.82\.91\.102|id_ed25519_gateway1301' "$MOUNT" 2>/dev/null || true)
hdiutil detach "$MOUNT" >/dev/null
rm -rf "$MOUNT"
[ -z "$LEAK" ] || { echo "artifact leaks private material: $LEAK" >&2; exit 1; }

# Retention: the newest verified release and the one before it, in dist/.
ls -1t dist/*.dmg 2>/dev/null | tail -n +3 | while read -r OLD; do
  mkdir -p "$HOME/Desktop/_trash/file-studio-kh/$(date +%Y-%m-%d) older release"
  mv "$OLD" "$HOME/Desktop/_trash/file-studio-kh/$(date +%Y-%m-%d) older release/"
done

printf 'Built %s (%s, kh.filestudio.app)\n' "$DMG" "$VERSION"
shasum -a 256 "$DMG"
