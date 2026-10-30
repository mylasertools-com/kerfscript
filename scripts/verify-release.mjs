// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Opens every archive and Linux package in release/ and checks that it holds
// its program and its licences. The release workflow runs it on the complete
// set before anything is signed or published.
//
//   node scripts/verify-release.mjs

import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const LICENCES = ['LICENSE', 'COMMERCIAL-LICENSE.md', 'THIRD-PARTY-NOTICES.md', 'OFL.txt'];
const APP = [...LICENCES, 'THIRD-PARTY-LICENSES.md'].map((f) => `usr/lib/KerfScript/${f}`);

// What each kind of file must contain, as paths inside it
const RULES = [
  [
    /^kerf-.+-windows-\w+\.zip$/,
    (top) => ['kerf.exe', 'README.md', ...LICENCES].map((f) => `${top}/${f}`),
  ],
  [
    /^kerf-.+-macos-\w+\.tar\.gz$/,
    (top) => ['kerf', 'README.md', ...LICENCES].map((f) => `${top}/${f}`),
  ],
  [
    /^kerf-.+-linux-\w+\.tar\.gz$/,
    (top) =>
      ['kerf', 'kerf.1', 'kerfscript.xml', 'README.md', ...LICENCES].map((f) => `${top}/${f}`),
  ],
  [
    /^kerfscript-wasm-.+\.zip$/,
    (top) =>
      ['kerfscript.wasm', 'webassembly.md', 'THIRD-PARTY-LICENSES.md', ...LICENCES].map(
        (f) => `${top}/${f}`,
      ),
  ],
  [
    /^kerfscript-desktop-.+\.deb$/,
    () => ['usr/bin/kerfscript', 'usr/share/mime/packages/com.mylasertools.KerfScript.xml', ...APP],
  ],
  [
    /^kerfscript-(?!desktop|wasm).+\.deb$/,
    () => [
      'usr/bin/kerf',
      'usr/share/man/man1/kerf.1',
      ...LICENCES.map((f) => `usr/share/doc/kerfscript/${f}`),
    ],
  ],
];

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 28 });
const systemTar =
  process.platform === 'win32' ? join(process.env.SystemRoot, 'System32/tar.exe') : 'tar';

function list(path) {
  if (path.endsWith('.tar.gz')) return run('tar', ['-tzf', path]).split('\n');
  if (path.endsWith('.zip'))
    try {
      return run('unzip', ['-Z1', path]).split('\n');
    } catch {
      return run(systemTar, ['-tf', path]).split('\n');
    }
  // dpkg-deb -c prints `ls -l` style lines ending in ./path
  return run('dpkg-deb', ['-c', path])
    .split('\n')
    .map((l) => l.replace(/^.*?\.\//, '').replace(/ -> .*$/, ''));
}

let checked = 0;
const problems = [];
for (const name of readdirSync('release').sort()) {
  const rule = RULES.find(([re]) => re.test(name));
  if (!rule) continue;
  if (name.endsWith('.deb')) {
    try {
      run('dpkg-deb', ['--version']);
    } catch {
      console.log(`skipped ${name}: dpkg-deb is not installed`);
      continue;
    }
  }
  const entries = new Set(list(join('release', name)).map((e) => e.replace(/\\/g, '/').trim()));
  const top = name.replace(/\.(zip|tar\.gz)$/, '');
  const absent = rule[1](top).filter((f) => !entries.has(f));
  if (absent.length) problems.push(`${name} is missing ${absent.join(', ')}`);
  checked++;
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`${checked} release files hold their programs and licences`);
