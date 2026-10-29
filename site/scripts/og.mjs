// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Draws public/og.png, the picture shown when a link to the site is shared,
// and the banner at the top of the README: the logo (public/brand, from
// brand/brand.mjs), the tagline and an assembled model from site/3d.
// IBM Plex Sans Condensed SemiBold and IBM Plex Mono Regular .ttf files
// must be in the folder given as the first argument; ImageMagick (magick)
// turns the WebP render into PNG for resvg.
//
//   node scripts/og.mjs <fonts folder>

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const fontsDir = process.argv[2];
if (!fontsDir) throw new Error('Give the folder with the IBM Plex .ttf files');
const site = join(import.meta.dirname, '..');
const repo = join(site, '..');

const logo = readFileSync(join(site, 'public/brand/logo.svg'), 'utf8')
  .replace(
    /<svg [^>]*viewBox="([^"]+)"[^>]*>/,
    '<svg x="64" y="44" width="470" height="310" viewBox="$1">',
  )
  .replace(/<title>.*?<\/title>/, '');
const model = execFileSync('magick', [
  join(site, 'public/3d/hadal.webp'),
  // Drop the faint floor tint, keep the real shadow
  ...['-channel', 'A', '-level', '14%,100%', '+channel'],
  ...['-background', '#f4f0e7', '-flatten', 'png:-'],
]).toString('base64');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#f4f0e7"/>
${logo}
<text font-family="IBM Plex Sans Condensed" font-weight="600" font-size="46" fill="#1f1c18">
<tspan x="72" y="438">A programming language</tspan>
<tspan x="72" y="494">for laser cutting.</tspan>
</text>
<line x1="72" y1="550" x2="560" y2="550" stroke="#d6cdbb" stroke-width="2"/>
<text x="72" y="590" font-family="IBM Plex Mono" font-size="22" fill="#7b7467">kerfscript.mylasertools.com</text>
<image x="596" y="88" width="584" height="438" href="data:image/png;base64,${model}"/>
</svg>`;

const png = new Resvg(svg, {
  font: {
    fontFiles: readdirSync(fontsDir)
      .filter((f) => f.endsWith('.ttf'))
      .map((f) => join(fontsDir, f)),
    loadSystemFonts: false,
  },
}).render();
writeFileSync(join(import.meta.dirname, '../public/og.png'), png.asPng());
console.log('public/og.png');
