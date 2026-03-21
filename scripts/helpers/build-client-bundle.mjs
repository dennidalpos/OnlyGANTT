import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = path.resolve(scriptDir, '..', '..');
const outdir = path.join(repoRoot, 'artifacts', 'build', 'client');

await build({
  absWorkingDir: repoRoot,
  entryPoints: [path.join(repoRoot, 'src', 'client', 'bundle-entry.jsx')],
  inject: [path.join(repoRoot, 'src', 'client', 'esbuild-shims', 'react-shim.js')],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: ['chrome109', 'edge109', 'firefox115'],
  outfile: path.join(outdir, 'app.bundle.js'),
  charset: 'utf8',
  legalComments: 'none',
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  loader: {
    '.js': 'js',
    '.jsx': 'jsx'
  }
});
