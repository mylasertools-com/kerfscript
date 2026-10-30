// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Writes a .sha256 and .sha512 file next to every release file in release/,
// and SHA256SUMS listing them all. The release workflow runs it once the
// command line, WebAssembly and desktop files are together.
//
//   node scripts/checksums.mjs

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SKIP = /\.(sha256|sha512|asc)$|^SHA256SUMS$/;

export function checksums(dir = 'release') {
  const sums = [];
  for (const name of readdirSync(dir).sort()) {
    if (SKIP.test(name) || !statSync(join(dir, name)).isFile()) continue;
    const data = readFileSync(join(dir, name));
    for (const algo of ['sha256', 'sha512']) {
      const hash = createHash(algo).update(data).digest('hex');
      writeFileSync(join(dir, `${name}.${algo}`), `${hash}  ${name}\n`);
      if (algo === 'sha256') sums.push(`${hash}  ${name}`);
    }
  }
  writeFileSync(join(dir, 'SHA256SUMS'), sums.join('\n') + '\n');
  return sums.length;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(`Wrote checksums for ${checksums()} files in release/`);
