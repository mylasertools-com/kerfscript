// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Writes desktop/THIRD-PARTY-LICENSES.md: the Rust crates compiled into the
// desktop app on Windows, macOS and Linux, with their licences, source links
// and licence texts (see scripts/rust-licenses.mjs). The installers carry the
// file next to the app. Run it after changing Cargo.lock; --check fails when
// the file is out of date, --fetch downloads missing licence files.
//
//   node scripts/licenses.mjs [--check | --fetch]        (from desktop/)

import { fileURLToPath } from 'node:url';
import { rustLicenses, writeOrCheck } from '../../scripts/rust-licenses.mjs';

const doc = rustLicenses({
  manifestDir: fileURLToPath(new URL('../src-tauri/', import.meta.url)),
  targets: [
    'x86_64-pc-windows-msvc',
    'aarch64-apple-darwin',
    'x86_64-apple-darwin',
    'x86_64-unknown-linux-gnu',
    'aarch64-unknown-linux-gnu',
  ],
  title: 'Third-party licences: KerfScript desktop app',
  intro: `The KerfScript desktop app is built from these Rust crates (Tauri and its
dependencies) on Windows, macOS and Linux. Each is listed with its licence
and the licence files it ships; the texts follow, each under the crates that
share it.

The page inside the app is KerfScript's own JavaScript; its notices are in
THIRD-PARTY-NOTICES.md. This file is made by \`desktop/scripts/licenses.mjs\`
from \`desktop/src-tauri/Cargo.lock\`.`,
  fetch: process.argv.includes('--fetch'),
});
writeOrCheck(
  fileURLToPath(new URL('../THIRD-PARTY-LICENSES.md', import.meta.url)),
  doc,
  'desktop/THIRD-PARTY-LICENSES.md',
);
