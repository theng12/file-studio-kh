// The app's check suite. Runs headless under ELECTRON_RUN_AS_NODE with `electron`
// replaced by test/electron-stub.ts, so nothing it creates is the owner's app data,
// and every file it touches lives in one throwaway folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { request as httpRequest } from 'node:http';

import { ScanService } from '../src/main/services/ScanService';
import { ActionPreviewService } from '../src/main/services/ActionPreviewService';
import { FileOperationService } from '../src/main/services/FileOperationService';
import { SettingsService } from '../src/main/services/SettingsService';
import { UpdateHoldService, guardedWork } from '../src/main/services/UpdateHoldService';

const workRoot = process.env.FSKH_TEST_DIR ?? join(tmpdir(), 'file-studio-kh-test');

/** One request, connection closed afterwards so nothing keeps the test process alive. */
function call(url: string, method: string, query: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(`${url}?${query}`, { method, headers: { connection: 'close' } }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => { body += chunk; });
      response.on('end', () => {
        try { resolve(JSON.parse(body) as Record<string, unknown>); } catch (error) { reject(error); }
      });
    });
    request.on('error', reject);
    request.end();
  });
}

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

    const unsettled = await call(base, 'POST', 'timeout_s=0&pause_s=3');
    assert.equal(unsettled.in_flight, 1);
    assert.equal(unsettled.safe, false);
    assert.equal(unsettled.dispatch_paused_s, 3);
    assert.ok(String((unsettled.unsettled as string[])[0]).includes('apply'));

    // New work is refused while held, by a message a person can read.
    await assert.rejects(() => guardedWork('scan', async () => undefined), /paused for an update/);

    // The same hold with a window long enough to settle answers safe, honestly.
    const settled = await call(base, 'POST', 'timeout_s=3&pause_s=2');
    assert.equal(settled.in_flight, 0);
    assert.equal(settled.safe, true);
    assert.deepEqual(settled.unsettled, []);
    assert.equal(released, true);

    // The pause is in memory only: it expires and work resumes without anyone calling DELETE.
    await new Promise((resolve) => setTimeout(resolve, 2100));
    await guardedWork('scan', async () => undefined);

    // DELETE releases at once.
    UpdateHoldService.begin('apply');
    const gone = await call(base, 'DELETE', '');
    assert.equal(gone.safe, true);
    assert.equal(gone.dispatch_paused_s, 0);
    await guardedWork('scan', async () => undefined);
  } finally {
    UpdateHoldService.stop();
  }
});

test('settings are clamped to their allowed range instead of trusted', () => {
  const narrow = SettingsService.set({ scanDepth: 100, thumbnailCacheLimitMb: 1, theme: 'neon' as never });
  assert.equal(narrow.scanDepth, 20);
  assert.equal(narrow.thumbnailCacheLimitMb, 128);
  assert.equal(narrow.theme, 'light');
  SettingsService.set({ scanDepth: 8, thumbnailCacheLimitMb: 1024 });
});
