// The app's check suite. Runs headless under ELECTRON_RUN_AS_NODE with `electron`
// replaced by test/electron-stub.ts, so nothing it creates is the owner's app data,
// and every file it touches lives in one throwaway folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { request as httpRequest } from 'node:http';

import { ScanService } from '../src/main/services/ScanService';
import { ActionPreviewService } from '../src/main/services/ActionPreviewService';
import { FileOperationService } from '../src/main/services/FileOperationService';
import { SettingsService } from '../src/main/services/SettingsService';
import { UpdateHoldService, guardedWork, holdTokenFault, readHoldToken } from '../src/main/services/UpdateHoldService';

const workRoot = process.env.FSKH_TEST_DATA_DIR ?? join(tmpdir(), 'file-studio-kh-test');

/** One request, connection closed afterwards so nothing keeps the test process alive. */
function request2(
  url: string,
  method: string,
  query: string,
  token?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = { connection: 'close' };
    if (token) headers.authorization = `Bearer ${token}`;
    const request = httpRequest(`${url}?${query}`, { method, headers }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => { body += chunk; });
      response.on('end', () => {
        let parsed: Record<string, unknown> = {};
        try { parsed = JSON.parse(body) as Record<string, unknown>; } catch { /* empty body is fine */ }
        resolve({ status: response.statusCode ?? 0, body: parsed });
      });
    });
    request.on('error', reject);
    request.end();
  });
}

function call(url: string, method: string, query: string, token?: string): Promise<Record<string, unknown>> {
  return request2(url, method, query, token).then((response) => response.body);
}

/** Writes a token file with an exact mode, in one throwaway folder per call. */
function tokenFile(contents: string, mode = 0o600): string {
  mkdirSync(workRoot, { recursive: true });
  const dir = mkdtempSync(join(workRoot, 'token-'));
  const path = join(dir, 'hold-token');
  writeFileSync(path, contents);
  chmodSync(path, mode);
  return path;
}

const GOOD_TOKEN = 'a'.repeat(64);

function makeRoot(files: string[]): string {
  mkdirSync(workRoot, { recursive: true });
  const root = mkdtempSync(join(workRoot, 'root-'));
  for (const file of files) {
    const absolute = join(root, file);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, `contents of ${file}`);
  }
  return root;
}

async function scanIds(root: string): Promise<{ batchId: string; ids: string[]; paths: string[] }> {
  const summary = await ScanService.start(root);
  assert.equal(summary.status, 'completed');
  const listed = ScanService.listFiles({ batchId: summary.batchId, limit: 500 });
  return {
    batchId: summary.batchId,
    ids: listed.files.map((file) => file.id),
    paths: listed.files.map((file) => file.relativePath),
  };
}

function idOf(ids: string[], paths: string[], wanted: string): string {
  const index = paths.indexOf(wanted);
  assert.notEqual(index, -1, `${wanted} was not scanned`);
  return ids[index];
}

test('a scan lists the folder and leaves _trash out of the results', async () => {
  const root = makeRoot(['keep.txt', 'notes/report.pdf', '_trash/already-gone.txt']);
  const summary = await ScanService.start(root);
  const listed = ScanService.listFiles({ batchId: summary.batchId, limit: 500 });

  assert.equal(summary.status, 'completed');
  assert.equal(summary.fileCount, 2);
  assert.deepEqual(listed.files.map((file) => file.relativePath).sort(), ['keep.txt', 'notes/report.pdf']);
});

test('trash preview, apply and undo put the files back where they were', async () => {
  const root = makeRoot(['one.txt', 'nested/two.txt']);
  const { batchId, ids } = await scanIds(root);

  const preview = ActionPreviewService.preview({ batchId, rootPath: root, fileIds: ids, operation: { type: 'trash' } });
  assert.equal(preview.readyCount, 2);
  assert.equal(preview.items.filter((item) => item.proposedRelativePath?.startsWith('_trash/')).length, 2);

  const applied = await FileOperationService.applyPreview(preview.previewId);
  assert.equal(applied.appliedCount, 2);
  assert.equal(applied.failedCount, 0);
  // Recorded as it runs, so an apply interrupted by an update or a crash is still undoable.
  const history = FileOperationService.listOperations().find((entry) => entry.id === applied.operationId);
  assert.equal(history?.appliedCount, 2);
  assert.equal(FileOperationService.getOperation(applied.operationId).items.length, 2);
  assert.equal(existsSync(join(root, 'one.txt')), false);
  assert.equal(existsSync(join(root, '_trash', 'one.txt')), true);
  assert.equal(existsSync(join(root, '_trash', 'nested', 'two.txt')), true);

  const undone = await FileOperationService.undoOperation(applied.operationId);
  assert.equal(undone.undoneCount, 2);
  assert.equal(existsSync(join(root, 'one.txt')), true);
  assert.equal(existsSync(join(root, 'nested', 'two.txt')), true);
});

test('a preview never proposes a path outside the selected root', async () => {
  const root = makeRoot(['photo.txt']);
  const { batchId, ids } = await scanIds(root);

  for (const targetFolder of ['../escape', '../../escape', 'a/../../escape']) {
    const preview = ActionPreviewService.preview({
      batchId, rootPath: root, fileIds: ids, operation: { type: 'move', targetFolder },
    });
    assert.equal(preview.readyCount, 0, `move to ${targetFolder} must not be ready`);
    assert.equal(preview.items[0].status, 'invalid');
  }
});

test('apply leaves a conflicting file alone and applies only the ready row', async () => {
  const root = makeRoot(['photo.txt', 'target/photo.txt']);
  const { batchId, ids, paths } = await scanIds(root);

  const preview = ActionPreviewService.preview({
    batchId, rootPath: root, fileIds: [idOf(ids, paths, 'photo.txt')], operation: { type: 'move', targetFolder: 'target' },
  });
  assert.equal(preview.conflictCount, 1);
  assert.equal(preview.readyCount, 0);

  const applied = await FileOperationService.applyPreview(preview.previewId);
  assert.equal(applied.appliedCount, 0);
  assert.equal(applied.failedCount, 0);
  assert.equal(applied.skippedCount, 1);
  assert.equal(existsSync(join(root, 'photo.txt')), true);
});

test('sequential numbering gives two files two different names', async () => {
  const root = makeRoot(['a.txt', 'b.txt']);
  const { batchId, ids } = await scanIds(root);

  const preview = ActionPreviewService.preview({
    batchId,
    rootPath: root,
    fileIds: ids,
    operation: { type: 'sequence', baseName: 'shot', start: 1, padding: 3, separator: '-' },
  });
  assert.equal(preview.readyCount, 2);
  assert.equal(preview.conflictCount, 0);
  assert.deepEqual(
    preview.items.map((item) => item.proposedRelativePath).sort(),
    ['shot-001.txt', 'shot-002.txt'],
  );
});

test('undo refuses to restore over a file that has come back', async () => {
  const root = makeRoot(['clash.txt']);
  const { batchId, ids } = await scanIds(root);

  const preview = ActionPreviewService.preview({ batchId, rootPath: root, fileIds: ids, operation: { type: 'trash' } });
  const applied = await FileOperationService.applyPreview(preview.previewId);
  writeFileSync(join(root, 'clash.txt'), 'a new file took the old name');

  const undone = await FileOperationService.undoOperation(applied.operationId);
  assert.equal(undone.undoneCount, 0);
  assert.equal(undone.failedCount, 1);
  assert.match(undone.items[0].message ?? '', /already has a file/);
});

test('the update hold pauses work, settles, answers, and resumes by itself', async () => {
  process.env.KHU_HOLD_TOKEN_FILE = tokenFile(GOOD_TOKEN);
  UpdateHoldService.start(0); // port 0: the OS picks a free one for the test
  try {
    const port = await new Promise<number>((resolve, reject) => {
      const started = Date.now();
      const probe = () => {
        const bound = UpdateHoldService.port();
        if (bound) return resolve(bound);
        if (Date.now() - started > 5000) return reject(new Error('hold endpoint never came up'));
        setTimeout(probe, 25);
      };
      probe();
    });
    const base = `http://127.0.0.1:${port}/api/maintenance/hold`;

    // Work that outlasts the settle window is reported unsettled instead of being called safe.
    let released = false;
    const work = guardedWork('apply', () => new Promise<void>((resolve) => {
      setTimeout(() => { released = true; resolve(); }, 800);
    }));
    await new Promise((resolve) => setTimeout(resolve, 100));

    const unsettled = await call(base, 'POST', 'timeout_s=0&pause_s=3', GOOD_TOKEN);
    assert.equal(unsettled.in_flight, 1);
    assert.equal(unsettled.safe, false);
    assert.equal(unsettled.dispatch_paused_s, 3);
    assert.ok(String((unsettled.unsettled as string[])[0]).includes('apply'));

    // New work is refused while held, by a message a person can read.
    await assert.rejects(() => guardedWork('scan', async () => undefined), /paused for an update/);

    // The same hold with a window long enough to settle answers safe, honestly.
    const settled = await call(base, 'POST', 'timeout_s=3&pause_s=2', GOOD_TOKEN);
    assert.equal(settled.in_flight, 0);
    assert.equal(settled.safe, true);
    assert.deepEqual(settled.unsettled, []);
    assert.equal(released, true);

    // The pause is in memory only: it expires and work resumes without anyone calling DELETE.
    await new Promise((resolve) => setTimeout(resolve, 2100));
    await guardedWork('scan', async () => undefined);

    // DELETE releases at once.
    UpdateHoldService.begin('apply');
    const gone = await call(base, 'DELETE', '', GOOD_TOKEN);
    assert.equal(gone.safe, true);
    assert.equal(gone.dispatch_paused_s, 0);
    await guardedWork('scan', async () => undefined);
  } finally {
    UpdateHoldService.stop();
    delete process.env.KHU_HOLD_TOKEN_FILE;
  }
});

test('the update key must be a 0600 file of exactly 64 hex characters', () => {
  // Missing file.
  const missing = join(mkdtempSync(join(workRoot, 'token-')), 'hold-token');
  assert.match(holdTokenFault(missing) ?? '', /missing/);
  assert.equal(readHoldToken(missing), null);

  // Readable by other users.
  const loose = tokenFile(GOOD_TOKEN, 0o644);
  assert.match(holdTokenFault(loose) ?? '', /must be 600/);
  assert.equal(readHoldToken(loose), null);

  // 63 characters, 65 characters, and non-hex all fail even at 0600.
  for (const bad of [GOOD_TOKEN.slice(0, 63), `${GOOD_TOKEN}f`, 'z'.repeat(64), '']) {
    const path = tokenFile(bad);
    assert.match(holdTokenFault(path) ?? '', /64 hex|empty/, `"${bad.slice(0, 8)}…" must be refused`);
    assert.equal(readHoldToken(path), null);
  }

  // The right shape is accepted.
  const good = tokenFile(GOOD_TOKEN);
  assert.equal(holdTokenFault(good), null);
  assert.equal(readHoldToken(good), GOOD_TOKEN);
});

test('the hold refuses a wrong key and accepts the right one', async () => {
  process.env.KHU_HOLD_TOKEN_FILE = tokenFile(GOOD_TOKEN);
  UpdateHoldService.start(0);
  try {
    const port = await new Promise<number>((resolve, reject) => {
      const started = Date.now();
      const probe = () => {
        const bound = UpdateHoldService.port();
        if (bound) return resolve(bound);
        if (Date.now() - started > 5000) return reject(new Error('hold endpoint never came up'));
        setTimeout(probe, 25);
      };
      probe();
    });
    const base = `http://127.0.0.1:${port}/api/maintenance/hold`;

    // No key, and a key that does not match, are both refused with a reason.
    const absent = await request2(base, 'POST', 'pause_s=30');
    assert.equal(absent.status, 401);
    assert.match(String(absent.body.error), /does not match/);
    const assertWrong = await request2(base, 'POST', 'pause_s=30', 'b'.repeat(64));
    assert.equal(assertWrong.status, 401);

    // The right key is accepted.
    const right = await request2(base, 'DELETE', '', GOOD_TOKEN);
    assert.equal(right.status, 200);
    assert.equal(right.body.safe, true);
  } finally {
    UpdateHoldService.stop();
    delete process.env.KHU_HOLD_TOKEN_FILE;
  }
});

test('a missing key file refuses the hold loudly instead of skipping the check', async () => {
  process.env.KHU_HOLD_TOKEN_FILE = join(mkdtempSync(join(workRoot, 'token-')), 'hold-token');
  UpdateHoldService.start(0);
  try {
    const port = await new Promise<number>((resolve, reject) => {
      const started = Date.now();
      const probe = () => {
        const bound = UpdateHoldService.port();
        if (bound) return resolve(bound);
        if (Date.now() - started > 5000) return reject(new Error('hold endpoint never came up'));
        setTimeout(probe, 25);
      };
      probe();
    });
    const base = `http://127.0.0.1:${port}/api/maintenance/hold`;

    // Even a request carrying a token is refused: the app has no key to compare against.
    const refused = await request2(base, 'POST', 'pause_s=30', GOOD_TOKEN);
    assert.equal(refused.status, 401);
    assert.match(String(refused.body.error), /missing/);
    assert.equal(refused.body.safe, false);
  } finally {
    UpdateHoldService.stop();
    delete process.env.KHU_HOLD_TOKEN_FILE;
  }
});

test('settings are clamped to their allowed range instead of trusted', () => {
  const narrow = SettingsService.set({ scanDepth: 100, thumbnailCacheLimitMb: 1, theme: 'neon' as never });
  assert.equal(narrow.scanDepth, 20);
  assert.equal(narrow.thumbnailCacheLimitMb, 128);
  assert.equal(narrow.theme, 'light');
  SettingsService.set({ scanDepth: 8, thumbnailCacheLimitMb: 1024 });
});
