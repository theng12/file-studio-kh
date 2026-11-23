#!/usr/bin/env node
/**
 * build-khsparkle.mjs — compiles the Sparkle shim call site for Electron.
 *
 *   native/khsparkle/khsparkle-addon.c  +  vendor/khsparkle/libkhsparkle.a  +  vendor/Sparkle.framework
 *     ->  dist-electron/khsparkle.node
 *
 * N-API, no node-gyp: headers come from whatever Electron/Node development headers are already on
 * this Mac. The addon keeps an @rpath for Sparkle so the shipped app resolves the framework from
 * Contents/Frameworks (the app's own `@executable_path/../Frameworks`), never a build path.
 * macOS only: on another platform this exits 0 without building.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'native', 'khsparkle', 'khsparkle-addon.c');
const lib = path.join(root, 'vendor', 'khsparkle', 'libkhsparkle.a');
const header = path.join(root, 'vendor', 'khsparkle', 'khsparkle.h');
const vendor = path.join(root, 'vendor', 'khsparkle');
const outDir = path.join(root, 'dist-electron');
const addon = path.join(outDir, 'khsparkle.node');

if (process.platform !== 'darwin') {
  console.log('build-khsparkle: skipped (macOS only)');
  process.exit(0);
}
for (const needed of [source, lib, header, path.join(vendor, 'Sparkle.framework')]) {
  if (!fs.existsSync(needed)) {
    console.error(`build-khsparkle: missing ${path.relative(root, needed)}`);
    process.exit(1);
  }
}

function headerCandidates() {
  const list = [
    path.resolve(path.dirname(fs.realpathSync(process.execPath)), '..', 'include', 'node'),
    path.join(root, 'node_modules', 'node-api-headers', 'include', 'node'),
    '/opt/homebrew/include/node',
    '/usr/local/include/node',
  ];
  const caches = [
    path.join(os.homedir(), 'Library', 'Caches', 'electron-gyp'),
    path.join(os.homedir(), '.electron-gyp'),
    path.join(os.homedir(), 'Library', 'Caches', 'node-gyp'),
    path.join(os.homedir(), '.cache', 'node-gyp'),
    path.join(os.homedir(), '.node-gyp'),
  ];
  for (const cache of caches) {
    let versions = [];
    try { versions = fs.readdirSync(cache); } catch { continue; }
    versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const version of versions) list.push(path.join(cache, version, 'include', 'node'));
  }
  return list;
}

const candidates = headerCandidates();
const headers = candidates.find((dir) => fs.existsSync(path.join(dir, 'node_api.h')));
if (!headers) {
  console.error('build-khsparkle: no local node_api.h found. Checked:');
  for (const dir of candidates) console.error(`  ${dir}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const compiled = spawnSync('clang', [
  '-std=c11', '-O2', '-fPIC', '-shared', '-mmacosx-version-min=12.0', '-DNAPI_VERSION=8',
  '-undefined', 'dynamic_lookup',
  // No absolute build path may ship.
  '-Wl,-install_name,@rpath/khsparkle.node',
  '-Wl,-rpath,@executable_path/../Frameworks',
  '-I', headers, '-I', path.join(root, 'vendor', 'khsparkle'),
  '-F', vendor, '-framework', 'Sparkle', '-framework', 'Foundation',
  '-o', addon,
  source, lib,
], { stdio: 'inherit' });
if (compiled.error || compiled.status !== 0) {
  console.error('build-khsparkle: clang failed (are the Xcode Command Line Tools present?)');
  process.exit(1);
}

// Load shape only, in a child: this addon links Sparkle through @executable_path/../Frameworks,
// which does not resolve outside a bundle, so the child is pointed at the vendored framework the
// way the §3 docs describe for test binaries. start() is never called (it needs the app's Info.plist).
const probe = spawnSync(
  process.execPath,
  ['-e', `const l=require(${JSON.stringify(addon)});console.log(JSON.stringify({start:typeof l.start,lastError:typeof l.lastError,state:typeof l.state}))`],
  { env: { ...process.env, DYLD_FRAMEWORK_PATH: vendor }, encoding: 'utf8' },
);
let shape;
try { shape = JSON.parse(probe.stdout.trim()); } catch { shape = {}; }
if (probe.status !== 0 || shape.start !== 'function' || shape.lastError !== 'function' || shape.state !== 'function') {
  console.error('build-khsparkle: built addon failed to load or is missing an export:', shape, probe.stderr);
  process.exit(1);
}
console.log(`build-khsparkle: OK -> ${path.relative(root, addon)} (${JSON.stringify(shape)})`);
