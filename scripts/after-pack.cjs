// electron-builder afterPack hook: put Sparkle.framework into Contents/Frameworks before signing.
// electron-builder signs after this hook, so the framework is signed nested-first with the app and
// never with a --deep pass (INTEGRATION.md §3C items 2-3). Symlinks (Versions/Current) are kept.
const { cpSync, existsSync, mkdirSync } = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(context) {
  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);
  const src = path.join(context.packager.projectDir, 'vendor', 'khsparkle', 'Sparkle.framework');
  const dest = path.join(appPath, 'Contents', 'Frameworks', 'Sparkle.framework');

  if (!existsSync(src)) throw new Error(`after-pack: no Sparkle.framework at ${src}`);
  if (!existsSync(appPath)) throw new Error(`after-pack: no app bundle at ${appPath}`);

  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true, verbatimSymlinks: true });
  console.log(`after-pack: copied Sparkle.framework -> ${path.relative(context.appOutDir, dest)}`);
};
