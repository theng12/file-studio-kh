// Repairs an Electron install whose own installer left `dist/` half-extracted.
// Seen on npm 11 + macOS 27: electron's install.js reports success but only writes
// part of the archive, so `Electron.app/Contents/MacOS/Electron` never appears and
// every build fails later with ENOENT. The zip itself is fine, so re-extract it
// with ditto. A normal install is left alone.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';

const electronDir = join(import.meta.dirname, '..', 'node_modules', 'electron');
const binary = join(electronDir, 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron');
if (platform() !== 'darwin' || existsSync(binary)) process.exit(0);

const pkg = execFileSync('node', ['-p', 'require("electron/package.json").version'], {
  cwd: join(import.meta.dirname, '..'),
  encoding: 'utf8',
}).trim();
const arch = process.arch;
const zipName = `electron-v${pkg}-darwin-${arch}.zip`;
const cacheRoots = [
  join(homedir(), 'Library', 'Caches', 'electron'),
  process.env.electron_config_cache ?? '',
].filter(Boolean);

let zip = null;
for (const root of cacheRoots) {
  if (!existsSync(root)) continue;
  for (const entry of readdirSync(root)) {
    const candidate = join(root, entry, zipName);
    if (existsSync(candidate)) { zip = candidate; break; }
  }
  if (zip) break;
}
if (!zip) {
  console.error(`ensure-electron: no cached ${zipName}; run "npm install electron" once and retry`);
  process.exit(1);
}

const dist = join(electronDir, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
execFileSync('ditto', ['-x', '-k', zip, dist]);
// electron/index.js reads path.txt verbatim, so no trailing newline.
writeFileSync(join(electronDir, 'path.txt'), 'Electron.app/Contents/MacOS/Electron');
if (!existsSync(binary)) {
  console.error(`ensure-electron: ${binary} is still missing after extracting ${zip}`);
  process.exit(1);
}
process.stdout.write(`ensure-electron: extracted ${zipName} with ditto\n`);
