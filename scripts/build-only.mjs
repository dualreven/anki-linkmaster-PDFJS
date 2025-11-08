// UTF-8; ensure explicit encoding for any file IO if added later
import { build } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Map CLI arg to build target
const arg = (process.argv[2] || '').toLowerCase();
const target = arg === 'viewer' ? 'pdf-viewer'
             : arg === 'home'   ? 'pdf-home'
             : null;

if (!target) {
  console.error('[build-only] Usage: node scripts/build-only.mjs <viewer|home>');
  process.exit(2);
}

// Set env for vite.config.js to pick the single entry
process.env.VITE_BUILD_ONLY = target;

// Base path per target
const base = target === 'pdf-viewer' ? '/pdf-viewer/' : '/pdf-home/';

// Output to the runtime static dir expected by the app
const outDir = path.resolve(__dirname, '..', 'dist', 'latest', 'static');

console.info(`[build-only] target=${target}, outDir=${outDir}, base=${base}`);

try {
  await build({
    configFile: path.resolve(__dirname, '..', 'vite.config.js'),
    base,
    build: {
      outDir,
      emptyOutDir: false // keep sibling bundle if both are built sequentially
    }
  });
  console.info(`[build-only] Done: ${target}`);
} catch (err) {
  console.error(`[build-only] Failed: ${target}`, err?.message || err);
  process.exit(1);
}

