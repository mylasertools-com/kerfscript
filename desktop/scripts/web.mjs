// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Makes desktop/web, the app's pages, from the website's playground so both
// stay the same: site/dist/playground/index.html becomes index.html, with
// the website's header, footer and web fonts taken out and desktop.js added.
// Build the site first: `npm run build` in the repository root, then
// `npm --prefix site run build`.

import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const site = new URL('../../site/dist/', import.meta.url);
const web = new URL('../web/', import.meta.url);
const page = new URL('playground/index.html', site);
if (!existsSync(page))
  throw new Error('site/dist/playground is missing: run `npm --prefix site run build` first');

rmSync(web, { recursive: true, force: true });
cpSync(new URL('assets/', site), new URL('assets/', web), { recursive: true });
cpSync(new URL('favicon.svg', site), new URL('favicon.svg', web));
cpSync(new URL('../src/desktop.js', import.meta.url), new URL('assets/desktop.js', web));
cpSync(new URL('../src/desktop.css', import.meta.url), new URL('assets/desktop.css', web));

let html = readFileSync(page, 'utf8');
const cut = (re, what) => {
  if (!re.test(html)) throw new Error(`The playground page changed: no ${what} to remove`);
  html = html.replace(re, '');
};
cut(/<header class="site-header">[\s\S]*?<\/header>/, 'header');
cut(/<footer class="site-footer">[\s\S]*?<\/footer>/, 'footer');
html = html
  .replace(/<link rel="(?:preconnect|canonical|alternate|sitemap)"[^>]*>/g, '')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts[^>]*>/g, '')
  .replace(/<meta (?:property|name)="(?:og|twitter):[^>]*>/g, '')
  .replace('<title>KerfScript playground</title>', '<title>KerfScript</title>')
  .replace(
    '</head>',
    '<link rel="stylesheet" href="/assets/desktop.css" /><script src="/assets/desktop.js"></script></head>',
  );
writeFileSync(new URL('index.html', web), html);
console.log('Wrote desktop/web/');
