import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { app } from 'electron';

function crashLogPath(): string {
  return join(app.getPath('userData'), 'crash.log');
}

export function logLifecycle(event: string, detail?: unknown): void {
  const payload = detail instanceof Error
    ? { name: detail.name, message: detail.message, stack: detail.stack }
    : detail;
  const line = JSON.stringify({
    at: new Date().toISOString(),
    event,
    detail: payload ?? null,
  });

  console.log(`[${event}]`, payload ?? '');

  try {
    const file = crashLogPath();
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, `${line}\n`, 'utf8');
  } catch (error) {
    console.error('Failed to write crash log', error);
  }
}
