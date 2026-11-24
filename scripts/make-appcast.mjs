#!/usr/bin/env node
/**
 * make-appcast.mjs — writes `docs/appcast.xml` from the exact DMG bytes that were published.
 *
 * The signature is Ed25519 over the file Sparkle will download, made with this app's own key
 * (~/.kh-sparkle/kh.filestudio.app/private.key, never committed). Re-run it whenever the DMG is
 * re-cut: a stale signature fails silently on every Mac. Sign the *published* bytes, not a
 * rebuild — point --dmg at the file whose sha matches the release asset.
 *
 *   node scripts/make-appcast.mjs --version 0.6.3 \
 *     --dmg "dist/File Studio KH-0.6.3-arm64.dmg" \
 *     --url "https://github.com/theng12/file-studio-kh/releases/download/0.6.3/File.Studio.KH-0.6.3-arm64.dmg"
 *
 * Env: SIGN_UPDATE (defaults to the shim's vendored binary), SU_PUBLIC_ED_KEY overrides the public
 * key written into the feed's own copy for convenience; the key lives in the app's Info.plist.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) {
    if (fallback === undefined) throw new Error(`missing --${name}`);
    return fallback;
  }
  return process.argv[i + 1];
}

const version = arg('version');
const dmg = path.resolve(root, arg('dmg'));
const url = arg('url');
const out = path.resolve(root, arg('out', 'docs/appcast.xml'));
const minSystem = arg('min-system', '12.0');
const feedUrl = 'https://theng12.github.io/file-studio-kh/appcast.xml';
const signUpdate = process.env.SIGN_UPDATE
  || `${process.env.HOME}/Developer/_orchestra/developer-system/sparkle-shim-20261123/vendor/bin/sign_update`;
const key = process.env.SPARKLE_KEY || path.join(os.homedir(), '.kh-sparkle', 'kh.filestudio.app', 'private.key');

if (!fs.existsSync(dmg)) { console.error(`make-appcast: no DMG at ${dmg}`); process.exit(2); }
if (!fs.existsSync(signUpdate)) { console.error(`make-appcast: no sign_update at ${signUpdate}`); process.exit(2); }
if (!fs.existsSync(key)) { console.error(`make-appcast: no key at ${key}`); process.exit(2); }

const signed = spawnSync(signUpdate, ['--ed-key-file', key, '-p', dmg], { encoding: 'utf8' });
if (signed.status !== 0) {
  console.error(`make-appcast: sign_update failed: ${signed.stderr || signed.stdout}`);
  process.exit(1);
}
// sign_update prints either `sparkle:edSignature="…" length="…"` or just the base64 signature.
const signature = /edSignature="([^"]+)"/.exec(signed.stdout)?.[1] ?? signed.stdout.trim();
const length = /length="(\d+)"/.exec(signed.stdout)?.[1] ?? String(fs.statSync(dmg).size);
if (!signature || !/^[A-Za-z0-9+/]+=*$/.test(signature)) { console.error(`make-appcast: no signature in sign_update output: ${signed.stdout}`); process.exit(1); }

// The notes for this version, from CHANGELOG.md, as the appcast's description.
const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');
const section = new RegExp(`## ${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} — [^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`).exec(changelog)?.[1]?.trim() ?? '';
const notes = section
  .split(/\n(?=### |## )/)
  .map((block) => block.replace(/^###\s*/, '').replace(/\n\s*-\s+/g, '\n• '))
  .join('\n\n');

const pubDate = new Date().toUTCString();
const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>File Studio KH</title>
    <link>${feedUrl}</link>
    <description>File Studio KH updates</description>
    <language>en</language>
    <item>
      <title>Version ${version}</title>
      <pubDate>${pubDate}</pubDate>
      <sparkle:version>${version}</sparkle:version>
      <sparkle:shortVersionString>${version}</sparkle:shortVersionString>
      <sparkle:minimumSystemVersion>${minSystem}</sparkle:minimumSystemVersion>
      <description><![CDATA[<pre>${notes.replace(/]]>/g, ']]&gt;')}</pre>]]></description>
      <enclosure url="${url}"
                 length="${length}" type="application/octet-stream" sparkle:edSignature="${signature}"/>
    </item>
  </channel>
</rss>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, xml);
console.log(`make-appcast: wrote ${path.relative(root, out)} (version ${version}, ${length} B)`);
console.log(`  verify: swift scripts/verify-appcast.swift "${dmg}" <SUPublicEDKey> "${signature}"`);
