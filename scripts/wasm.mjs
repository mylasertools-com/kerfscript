// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Builds dist/kerfscript.wasm, a WASI module that runs KerfScript in any
// WebAssembly runtime (see docs/webassembly.md). Needs Javy
// (https://github.com/bytecodealliance/javy) on the PATH, or set JAVY to the
// javy binary.
//
//   node scripts/wasm.mjs

import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { build } from 'esbuild';

const JAVY = process.env.JAVY ?? 'javy';
mkdirSync('dist', { recursive: true });
await build({
  entryPoints: ['src/wasm.ts'],
  outfile: 'out/wasm/kerfscript.js',
  bundle: true,
  minify: true,
  format: 'esm',
  platform: 'neutral',
  mainFields: ['module', 'main'],
  target: 'es2020',
  loader: { '.ttf': 'binary' },
  plugins: [
    {
      name: 'no-node-builtins',
      setup(b) {
        b.onResolve({ filter: /^fs$/ }, () => ({ path: 'fs', namespace: 'empty' }));
        b.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: 'module.exports = {}' }));
      },
    },
  ],
});
execFileSync(
  JAVY,
  [
    'build',
    '-J',
    'javy-stream-io=y',
    '-J',
    'text-encoding=y',
    '-o',
    'dist/kerfscript.wasm',
    'out/wasm/kerfscript.js',
  ],
  { stdio: 'inherit' },
);
console.log(
  `Wrote dist/kerfscript.wasm (${(statSync('dist/kerfscript.wasm').size / 1e6).toFixed(1)} MB)`,
);
