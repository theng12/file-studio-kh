// Runs the built check bundle under Electron-as-node with its own throwaway data folder.
// Electron's Node has the ABI the native modules were built for, so this is the only runtime
// where better-sqlite3 and sharp load the way they do in the app.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import electronPath from 'electron';

const dir = mkdtempSync(join(tmpdir(), 'file-studio-kh-check-'));
const child = spawn(electronPath, ['.test-build/check.js', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', FSKH_TEST_DIR: dir },
});
child.on('exit', (code) => {
  rmSync(dir, { recursive: true, force: true });
  process.exit(code ?? 1);
});
