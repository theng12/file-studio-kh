// Bundles test/check.ts for the Electron-as-node runtime, with `electron` replaced by a stub.
// The source is TypeScript built by vite, so tests run the same code the app ships.
import { build } from 'vite';
import { fileURLToPath } from 'node:url';

const here = (name) => fileURLToPath(new URL(name, import.meta.url));

await build({
  configFile: false,
  logLevel: 'warn',
  resolve: { alias: { electron: here('./electron-stub.ts') } },
  build: {
    outDir: here('../.test-build'),
    emptyOutDir: true,
    minify: false,
    ssr: here('./check.ts'),
    rollupOptions: {
      external: (id) => /^(node:|better-sqlite3$|sharp$)/.test(id),
    },
  },
});
