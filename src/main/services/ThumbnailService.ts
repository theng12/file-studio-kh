import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { app } from 'electron';
import sharp from 'sharp';
import { SettingsService } from './SettingsService';
import type { CacheStats } from '../../shared/types/app';

function cacheDir(): string {
  return join(app.getPath('userData'), 'data', 'thumbnail-cache');
}

function cacheKey(sourcePath: string): string {
  const stat = statSync(sourcePath);
  return createHash('sha1')
    .update(sourcePath)
    .update(String(stat.mtimeMs))
    .update(String(stat.size))
    .digest('hex')
    .slice(0, 24);
}

function cachePath(sourcePath: string): string {
  return join(cacheDir(), `${cacheKey(sourcePath)}.webp`);
}

function listCacheFiles(): Array<{ path: string; size: number; mtimeMs: number }> {
  if (!existsSync(cacheDir())) return [];

  return readdirSync(cacheDir(), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.webp'))
    .map((entry) => {
      const path = join(cacheDir(), entry.name);
      const stats = statSync(path);
      return { path, size: stats.size, mtimeMs: stats.mtimeMs };
    });
}

function cacheLimitBytes(): number {
  return SettingsService.get().thumbnailCacheLimitMb * 1024 * 1024;
}

export async function readImageDimensions(sourcePath: string): Promise<{ width: number | null; height: number | null }> {
  try {
    const metadata = await sharp(sourcePath, { failOn: 'none' }).metadata();
    return {
      width: metadata.width ?? null,
      height: metadata.height ?? null,
    };
  } catch {
    return { width: null, height: null };
  }
}

export async function readImagePerceptualHash(sourcePath: string): Promise<string | null> {
  try {
    const pixels = await sharp(sourcePath, { failOn: 'none' })
      .rotate()
      .resize(9, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer();
    let bits = '';
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const left = pixels[y * 9 + x];
        const right = pixels[y * 9 + x + 1];
        bits += left > right ? '1' : '0';
      }
    }
    return BigInt(`0b${bits}`).toString(16).padStart(16, '0');
  } catch {
    return null;
  }
}

export const ThumbnailService = {
  async getDataUrl(sourcePath: string): Promise<string | null> {
    try {
      const target = cachePath(sourcePath);
      if (!existsSync(target)) {
        mkdirSync(dirname(target), { recursive: true });
        await sharp(sourcePath, { failOn: 'none' })
          .rotate()
          .resize(96, 96, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 72 })
          .toFile(target);
        this.enforceLimit();
      }

      const bytes = readFileSync(target);
      return `data:image/webp;base64,${bytes.toString('base64')}`;
    } catch {
      return null;
    }
  },

  stats(): CacheStats {
    const files = listCacheFiles();
    return {
      fileCount: files.length,
      sizeBytes: files.reduce((sum, file) => sum + file.size, 0),
      limitBytes: cacheLimitBytes(),
    };
  },

  clear(): CacheStats {
    if (existsSync(cacheDir())) {
      rmSync(cacheDir(), { recursive: true, force: true });
    }
    mkdirSync(cacheDir(), { recursive: true });
    return this.stats();
  },

  enforceLimit(): CacheStats {
    const limit = cacheLimitBytes();
    const files = listCacheFiles().sort((a, b) => a.mtimeMs - b.mtimeMs);
    let total = files.reduce((sum, file) => sum + file.size, 0);

    for (const file of files) {
      if (total <= limit) break;
      try {
        unlinkSync(file.path);
        total -= file.size;
      } catch {
        // Cache cleanup is best-effort; stale files can be retried later.
      }
    }

    return this.stats();
  },
};
