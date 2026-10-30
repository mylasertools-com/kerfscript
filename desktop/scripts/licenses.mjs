// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Writes desktop/THIRD-PARTY-LICENSES.md: every Rust crate built into the
// desktop app on Windows, macOS or Linux, with its licence and the licence
// files it ships. The installers carry the file next to the app. Run it after
// changing Cargo.lock; --check fails when the file is out of date.
//
//   node scripts/licenses.mjs [--check]        (from desktop/)

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TARGETS = [
  'x86_64-pc-windows-msvc',
  'aarch64-apple-darwin',
  'x86_64-apple-darwin',
  'x86_64-unknown-linux-gnu',
  'aarch64-unknown-linux-gnu',
];
const LICENCE_FILE = /^(licen[cs]e|copying|notice|copyright|unlicense)([-_.].*)?$/i;
const crateDir = fileURLToPath(new URL('../src-tauri/', import.meta.url));
const out = fileURLToPath(new URL('../THIRD-PARTY-LICENSES.md', import.meta.url));

// Crates reachable from the app on any target, leaving out dev-dependencies
const crates = new Map();
let root = null;
for (const target of TARGETS) {
  const meta = JSON.parse(
    execFileSync(
      'cargo',
      ['metadata', '--format-version', '1', '--locked', '--filter-platform', target],
      { cwd: crateDir, maxBuffer: 1 << 28 },
    ),
  );
  root = meta.resolve.root;
  const packages = new Map(meta.packages.map((p) => [p.id, p]));
  const nodes = new Map(meta.resolve.nodes.map((n) => [n.id, n]));
  const queue = [root];
  const seen = new Set(queue);
  while (queue.length) {
    for (const dep of nodes.get(queue.pop()).deps) {
      if (dep.dep_kinds.every((k) => k.kind === 'dev') || seen.has(dep.pkg)) continue;
      seen.add(dep.pkg);
      queue.push(dep.pkg);
    }
  }
  for (const id of seen) if (id !== root) crates.set(id, packages.get(id));
}

const text = (file) =>
  readFileSync(file, 'utf8')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trim();

// Licence files, shared between crates when the text is the same
const texts = new Map();
const rows = [];
const missing = [];
for (const pkg of [...crates.values()].sort(
  (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
)) {
  const dir = dirname(pkg.manifest_path);
  const files = readdirSync(dir)
    .filter((f) => LICENCE_FILE.test(f) && statSync(join(dir, f)).isFile())
    .sort();
  if (
    pkg.license_file &&
    existsSync(join(dir, pkg.license_file)) &&
    !files.includes(pkg.license_file)
  )
    files.push(pkg.license_file);
  const refs = [];
  for (const f of files) {
    const body = text(join(dir, f));
    if (!body) continue;
    const hash = createHash('sha256').update(body).digest('hex').slice(0, 12);
    if (!texts.has(hash)) texts.set(hash, { body, crates: [] });
    texts.get(hash).crates.push(`${pkg.name} ${pkg.version}`);
    refs.push(`[${f}](#${hash})`);
  }
  if (!refs.length) missing.push(pkg);
  rows.push(
    `| ${pkg.name} | ${pkg.version} | ${pkg.license ?? 'see file'} | ${refs.join(', ') || `none; ${(pkg.authors ?? []).join(', ').replace(/[<>|]/g, '') || 'no authors listed'}`} |`,
  );
}

const fence = (body) => {
  let ticks = '```';
  while (body.includes(ticks)) ticks += '`';
  return `${ticks}text\n${body}\n${ticks}`;
};
const doc = `# Third-party licences: KerfScript desktop app

The KerfScript desktop app is built from these Rust crates (Tauri and its
dependencies) on Windows, macOS and Linux. Each is listed with its licence
and the licence files it ships; the texts follow, each shared by the crates
named above it. Crates without a licence file are under the licence named in
their package metadata, whose standard text appears below for another crate.

The page inside the app is KerfScript's own JavaScript and its notices are in
THIRD-PARTY-NOTICES.md. This file is made by \`desktop/scripts/licenses.mjs\`
from \`desktop/src-tauri/Cargo.lock\`.

| Crate | Version | Licence | Licence files |
| --- | --- | --- | --- |
${rows.join('\n')}

## Licence texts
${[...texts]
  .map(
    ([hash, { body, crates: users }]) =>
      `\n<a id="${hash}"></a>\n\n### ${users.join(', ')}\n\n${fence(body)}\n`,
  )
  .join('')}`;

// Crates published without licence files. With Apache-2.0 or MPL-2.0 among
// their licences, that text above applies; MIT and BSD-3-Clause need the
// copyright line, so their standard text is written out for each crate.
const MIT = (holder) => `Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
const BSD3 = (holder) => `Copyright (c) ${holder}

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`;
const standard = missing
  .filter((pkg) => !/Apache-2.0|MPL-2.0/.test(pkg.license ?? ''))
  .map((pkg) => {
    const holder =
      (pkg.authors ?? []).map((a) => a.replace(/s*<[^>]*>/, '')).join(', ') ||
      `the ${pkg.name} authors (${pkg.repository ?? 'crates.io'})`;
    const body = /BSD-3-Clause/.test(pkg.license) ? BSD3(holder) : MIT(holder);
    return `
### ${pkg.name} ${pkg.version} (${pkg.license}, no licence file in the crate)

${fence(body)}
`;
  })
  .join('');
const docWithStandard = standard
  ? doc +
    `
## Licences of crates without licence files
${standard}`
  : doc;

if (process.argv.includes('--check')) {
  const current = existsSync(out) ? readFileSync(out, 'utf8') : '';
  if (current !== docWithStandard) {
    console.error('desktop/THIRD-PARTY-LICENSES.md is out of date: run node scripts/licenses.mjs');
    process.exit(1);
  }
  console.log(`desktop/THIRD-PARTY-LICENSES.md is up to date (${crates.size} crates)`);
} else {
  writeFileSync(out, docWithStandard);
  console.log(
    `Wrote desktop/THIRD-PARTY-LICENSES.md: ${crates.size} crates, ${texts.size} licence texts`,
  );
}
