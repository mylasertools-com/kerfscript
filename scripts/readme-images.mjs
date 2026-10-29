// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Renders the model pictures in the README into .github/readme/, from the
// same build-time renders the website uses. Run from site/:
//   node ../scripts/readme-images.mjs

import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { displaySvg } from '../site/public/assets/display.js';
import { models } from '../site/src/lib/site.mjs';
import { render } from '../dist/index.js';

const { Resvg } = createRequire(import.meta.url)('../site/node_modules/@resvg/resvg-js');
const OUT = new URL('../.github/readme/', import.meta.url);
const PICKS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      'hadal',
      'tilt-maze',
      'topo-island',
      'fractal-tree',
      'round-badge',
      'winterlight',
      'xenospora',
      'solstice',
      'box',
      'gears',
      'gift-tags',
      'clock-face',
    ];

// The cards on the site share one set of wood textures; a picture needs its own
const DEFS = /<defs>[\s\S]*?<\/defs>/.exec(displaySvg(render('rect(10);'), { defs: true }))[0];

const W = 720;
const H = 540;
const PAD = 36;

for (const slug of PICKS) {
  const m = models.find((x) => x.slug === slug);
  const inner = DEFS + m.thumb.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const vb = /viewBox="([^"]+)"/.exec(m.thumb)[1].split(/\s+/).map(Number);
  const s = Math.min((W - 2 * PAD) / vb[2], (H - 2 * PAD) / vb[3]);
  const x = (W - vb[2] * s) / 2;
  const y = (H - vb[3] * s) / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#f4efe6"/>
<svg x="${x}" y="${y}" width="${vb[2] * s}" height="${vb[3] * s}" viewBox="${vb.join(' ')}">${inner}</svg></svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  writeFileSync(new URL(`model-${slug}.png`, OUT), png);
  console.log(slug, png.length);
}
