// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Tells IndexNow search engines (Bing, Yandex, Seznam, Naver) about every
// page in the deployed sitemap. Run after a deploy that adds or changes pages.
//
//   node scripts/indexnow.mjs

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const HOST = 'kerfscript.mylasertools.com';
const key = readdirSync(join(import.meta.dirname, '../public'))
  .find((f) => /^[0-9a-f]{32}\.txt$/.test(f))
  ?.slice(0, -4);
if (!key) throw new Error('No IndexNow key file in public/');

const index = await (await fetch(`https://${HOST}/sitemap-index.xml`)).text();
const urls = [];
for (const [, sitemap] of index.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const xml = await (await fetch(sitemap)).text();
  for (const [, loc] of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(loc);
}
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: HOST,
    key,
    keyLocation: `https://${HOST}/${key}.txt`,
    urlList: urls,
  }),
});
console.log(`${urls.length} URLs submitted: HTTP ${res.status} ${await res.text()}`);
