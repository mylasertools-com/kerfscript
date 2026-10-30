// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Writes packaging/wasm/THIRD-PARTY-LICENSES.md: the JavaScript engine that
// Javy builds into kerfscript.wasm (its javy-plugin crate, with QuickJS
// through rquickjs) and the Rust crates compiled into it, with their licences
// (see scripts/rust-licenses.mjs). Release files carry it next to the module.
// Run it after changing JAVY_VERSION; --check fails when the file is out of
// date. It clones Javy at that version into a temporary folder.
//
//   node scripts/wasm-licenses.mjs [--check | --fetch]

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rustLicenses, writeOrCheck } from './rust-licenses.mjs';

// Keep in step with JAVY_VERSION in .github/workflows/release.yml
export const JAVY_VERSION = 'v9.1.0';

const work = mkdtempSync(join(tmpdir(), 'kerf-javy-'));
try {
  execFileSync(
    'git',
    [
      '-c',
      'advice.detachedHead=false',
      'clone',
      '--quiet',
      '--depth',
      '1',
      '--branch',
      JAVY_VERSION,
      'https://github.com/bytecodealliance/javy.git',
      work,
    ],
    { stdio: 'inherit' },
  );
  const doc = rustLicenses({
    manifestDir: work,
    targets: ['wasm32-wasip1'],
    rootName: 'javy-plugin',
    includeRoot: true,
    title: 'Third-party licences: kerfscript.wasm',
    intro: `kerfscript.wasm runs KerfScript's JavaScript on a JavaScript engine that
[Javy](https://github.com/bytecodealliance/javy) ${JAVY_VERSION} builds into the module:
Javy's javy-plugin crate with QuickJS (through rquickjs) and the Rust crates
below. Each is listed with its licence and the licence files it ships; the
texts follow, each under the crates that share it. KerfScript's own code and
the JavaScript libraries it bundles are covered by LICENSE and
THIRD-PARTY-NOTICES.md.

This file is made by \`scripts/wasm-licenses.mjs\` from Javy's Cargo.lock.`,
    pathSource: `https://github.com/bytecodealliance/javy/tree/${JAVY_VERSION}`,
    fetch: process.argv.includes('--fetch'),
  });
  writeOrCheck(
    fileURLToPath(new URL('../packaging/wasm/THIRD-PARTY-LICENSES.md', import.meta.url)),
    doc,
    'packaging/wasm/THIRD-PARTY-LICENSES.md',
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
