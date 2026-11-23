/**
 * Update hold — the loopback endpoint the installer asks before it replaces this app
 * (fleet contract, owner 2026-11-15). POST pauses new scan/apply work for `pause_s`,
 * waits up to `timeout_s` for in-flight applies to settle, and answers honestly.
 * DELETE resumes at once. Everything lives in memory: the pause expires on a timer,
 * so an install that aborts can never leave an app that has stopped taking work.
 *
 * This app has no queue: the only work a restart could strand is one running
 * `applyPreview` or scan, so `in_flight` is 0 or 1 and unsettled names it.
 *
 *   POST   /api/maintenance/hold?timeout_s=20&pause_s=120
 *   DELETE /api/maintenance/hold
 *   →      {"safe":bool,"unsettled":[],"dispatch_paused_s":120,"in_flight":0}
 *
 * Loopback only, plain HTTP: the signed feed names the full URL for the installer,
 * and a remote caller has no business holding this app.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { app } from 'electron';

const DEFAULT_TIMEOUT_S = 20;
const MAX_TIMEOUT_S = 30;
const DEFAULT_PAUSE_S = 120;
const MAX_PAUSE_S = 900;
const SETTLE_POLL_MS = 200;

/** This app's own hold port, distinct from every other studio's (8642-8649, 13181). */
const HOLD_PORT = 8651;
const HOLD_PATH = '/api/maintenance/hold';

/**
 * The Launcher/installer credential (§2d): this app's own 0600 file holding 64 hex characters,
 * read fresh on every request. `KHU_HOLD_TOKEN_FILE` overrides the path for headless checks.
 */
const TOKEN_ENV = 'KHU_HOLD_TOKEN_FILE';

export function holdTokenPath(): string {
  const override = process.env[TOKEN_ENV]?.trim();
  return override ? override : join(app.getPath('userData'), 'hold-token');
}

/** Why the token cannot be trusted, as words the app can print; `null` when it is usable. */
export function holdTokenFault(path = holdTokenPath()): string | null {
  let meta;
  try {
    meta = lstatSync(path);
  } catch {
    return 'The update key file is missing.';
  }
  if (meta.isSymbolicLink()) return 'The update key file is a symlink.';
  if (!meta.isFile()) return 'The update key is not a regular file.';
  if (meta.size > 512) return 'The update key file is oversized.';
  if ((meta.mode & 0o077) !== 0) {
    return `The update key file is readable or writable by other users (mode ${(meta.mode & 0o777).toString(8).padStart(3, '0')}); it must be 600.`;
  }
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return 'The update key file cannot be read.';
  }
  const token = raw.trim();
  if (!token) return 'The update key file is empty.';
  if (token.length !== 64 || !/^[0-9a-f]{64}$/i.test(token)) {
    return 'The update key is not 64 hex characters.';
  }
  return null;
}

/** Reads the credential fresh on every request; anything the fault names fails closed. */
export function readHoldToken(path = holdTokenPath()): string | null {
  if (holdTokenFault(path)) return null;
  return readFileSync(path, 'utf8').trim();
}

/** The retiring updater's token is copied here once (never overwriting, never re-creating), so the
 *  hold works on a Mac that already has one and a deleted key cannot quietly reappear. */
function migrateLegacyToken(): void {
  if (process.env[TOKEN_ENV]?.trim()) return; // an explicit path is a test/override, never migrated into
  const own = holdTokenPath();
  if (existsSync(own)) return;
  const legacy = join(homedir(), 'Library', 'KHUpdater', 'state', 'hold-token');
  if (holdTokenFault(legacy)) return;
  try {
    mkdirSync(dirname(own), { recursive: true });
    writeFileSync(own, readFileSync(legacy), { mode: 0o600 });
    log(`the update key moved from ${legacy} to ${own}; the updater's copy is no longer read`);
  } catch (error) {
    log(`the update key could not be moved: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function presentedToken(request: IncomingMessage): string | null {
  const authorization = request.headers.authorization;
  if (typeof authorization === 'string') {
    const bearer = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
    if (bearer) return bearer[1];
  }
  const hub = request.headers['x-hub-token'];
  const raw = Array.isArray(hub) ? hub[0] : hub;
  return raw?.trim() || null;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

let server: Server | null = null;
let pausedUntil = 0;
let pauseTimer: NodeJS.Timeout | null = null;
let available = false;
let inFlightCount = 0;
let inFlightLabel: string | null = null;

function log(message: string): void {
  process.stderr.write(`[update-hold] ${message}\n`);
}

export const PAUSED_MESSAGE =
  'The app is paused for an update. It starts taking work again by itself in a moment.';

/** Called at the IPC boundary around the one kind of work a restart could strand. */
export function guardedWork<T>(label: string, work: () => Promise<T>): Promise<T> {
  if (UpdateHoldService.isPaused()) return Promise.reject(new Error(PAUSED_MESSAGE));
  UpdateHoldService.begin(label);
  return work().finally(() => UpdateHoldService.end());
}

/** Called by ScanService / FileOperationService around the one kind of work a restart could strand. */
export const UpdateHoldService = {
  begin(label: string): void {
    inFlightCount += 1;
    inFlightLabel = label;
  },

  end(): void {
    inFlightCount = Math.max(0, inFlightCount - 1);
    if (inFlightCount === 0) inFlightLabel = null;
  },

  isPaused(): boolean {
    return Date.now() < pausedUntil;
  },

  /** Did the loopback hold open? When it did not, no update may start. */
  isAvailable(): boolean {
    return available;
  },

  /** What the UI shows: the listener state and why the key is unusable, if it is. */
  status(): { available: boolean; tokenFault: string | null } {
    return { available, tokenFault: holdTokenFault() };
  },

  start(port = HOLD_PORT): void {
    if (server) return;
    migrateLegacyToken();
    const app = createServer((request, response) => {
      void handle(request, response);
    });
    app.on('error', (error) => {
      available = false;
      log(`hold endpoint unavailable: ${error.message}`);
    });
    // A second copy of the app failing to bind is fine: the first copy holds.
    app.listen(port, '127.0.0.1', () => {
      available = true;
      const fault = holdTokenFault();
      log(
        fault
          ? `listening on 127.0.0.1:${UpdateHoldService.port() ?? port}, but it will refuse every request: ${fault}`
          : `listening on 127.0.0.1:${UpdateHoldService.port() ?? port}`,
      );
    });
    server = app;
  },

  /** The port actually bound; null until the listener is up. */
  port(): number | null {
    const address = server?.address();
    return typeof address === 'object' && address ? address.port : null;
  },

  stop(): void {
    if (pauseTimer) clearTimeout(pauseTimer);
    pauseTimer = null;
    pausedUntil = 0;
    server?.close();
    server = null;
    available = false;
  },
};

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (url.pathname !== HOLD_PATH) {
    response.writeHead(404).end();
    return;
  }

  // Never skip the check: a browser origin, an unusable key or a wrong key all fail loudly.
  if (request.headers.origin) {
    log('refused a request carrying a browser origin');
    fail(response, 403, 'A browser origin is not allowed.');
    return;
  }
  const expected = readHoldToken();
  if (!expected) {
    const fault = holdTokenFault() ?? 'The update key is unavailable.';
    log(`refused a request: ${fault}`);
    fail(response, 401, fault);
    return;
  }
  if (!constantTimeEqual(presentedToken(request) ?? '', expected)) {
    log('refused a request: the update key does not match');
    fail(response, 401, 'The update key does not match.');
    return;
  }

  if (request.method === 'DELETE') {
    if (pauseTimer) clearTimeout(pauseTimer);
    pauseTimer = null;
    pausedUntil = 0;
    log('hold released; new work resumes');
    reply(response, { safe: true, unsettled: [], dispatch_paused_s: 0, in_flight: inFlightCount });
    return;
  }

  if (request.method !== 'POST') {
    response.writeHead(405).end();
    return;
  }

  const timeoutS = clamp(numberParam(url, 'timeout_s', DEFAULT_TIMEOUT_S), 0, MAX_TIMEOUT_S);
  const pauseS = clamp(numberParam(url, 'pause_s', DEFAULT_PAUSE_S), 1, MAX_PAUSE_S);
  pausedUntil = Date.now() + pauseS * 1000;
  if (pauseTimer) clearTimeout(pauseTimer);
  pauseTimer = setTimeout(() => {
    pauseTimer = null;
    pausedUntil = 0;
    log(`the pause ran out; new work resumes by itself`);
  }, pauseS * 1000);
  pauseTimer.unref?.();

  log(`held: ${inFlightCount && inFlightLabel ? inFlightLabel : 'nothing'} in flight, new work paused ${pauseS} s, settling for up to ${timeoutS} s`);

  const deadline = Date.now() + timeoutS * 1000;
  while (inFlightCount > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, SETTLE_POLL_MS));
  }

  const unsettled = inFlightCount > 0 && inFlightLabel ? [`${inFlightLabel} (still running)`] : [];
  reply(response, { safe: unsettled.length === 0, unsettled, dispatch_paused_s: pauseS, in_flight: inFlightCount });
}

function numberParam(url: URL, name: string, fallback: number): number {
  const raw = url.searchParams.get(name);
  if (raw === null || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max);
}

function reply(response: ServerResponse, body: Record<string, unknown>): void {
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

function fail(response: ServerResponse, status: number, error: string): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ safe: false, unsettled: [], dispatch_paused_s: 0, error }));
}
