// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Copies the installers `tauri build` made into ../release/, named like the
// other release files: kerfscript-desktop-<version>-<os>-<arch>.<ext>.
// KERF_LABEL names a nightly snapshot instead of the version.
//
//   node scripts/collect.mjs        (from desktop/, after npm run build)

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const label = process.env.KERF_LABEL ?? version;
const target = join(root, 'desktop/src-tauri/target');
const out = join(root, 'release');
mkdirSync(out, { recursive: true });

// Kinds of installer: the folder tauri writes it to, its extension, and the
// end of our file name.
const KINDS = [
  ['nsis', /\.exe$/, 'setup.exe'],
  ['msi', /\.msi$/, 'msi'],
  ['dmg', /\.dmg$/, 'dmg'],
  ['deb', /\.deb$/, 'deb'],
  ['rpm', /\.rpm$/, 'rpm'],
  ['appimage', /\.AppImage$/, 'AppImage'],
];
const OS = { nsis: 'windows', msi: 'windows', dmg: 'macos' };

const arch = (name) =>
  /universal/.test(name) ? 'universal' : /aarch64|arm64/.test(name) ? 'arm64' : 'x64';

// target/release/bundle, or target/<triple>/release/bundle when cross-building
const bundles = [join(target, 'release/bundle')];
if (existsSync(target))
  for (const d of readdirSync(target)) bundles.push(join(target, d, 'release/bundle'));

const made = [];
for (const bundle of bundles) {
  for (const [dir, ext, end] of KINDS) {
    const from = join(bundle, dir);
    if (!existsSync(from)) continue;
    for (const name of readdirSync(from).filter((n) => ext.test(n))) {
      const os = OS[dir] ?? 'linux';
      const file = `kerfscript-desktop-${label}-${os}-${arch(name)}${end === 'setup.exe' ? '-' : '.'}${end}`;
      copyFileSync(join(from, name), join(out, file));
      made.push(file);
    }
  }
}
if (!made.length) throw new Error('No installers found: run `npm run build` in desktop/ first');
console.log(`Copied to release/:\n  ${made.join('\n  ')}`);
