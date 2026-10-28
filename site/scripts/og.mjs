// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Draws public/og.png, the picture shown when a link to the site is shared.
// The model in it is rendered by KerfScript like every other picture here.
// IBM Plex Sans Condensed SemiBold and IBM Plex Mono Regular .ttf files
// must be in the folder given as the first argument.
//
//   node scripts/og.mjs <fonts folder>

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { render } from '../../dist/index.js';
import { DISPLAY_DEFS, displaySvg } from '../public/assets/display.js';

const fontsDir = process.argv[2];
if (!fontsDir) throw new Error('Give the folder with the IBM Plex .ttf files');
const repo = join(import.meta.dirname, '../..');
const atkinson = readFileSync(join(repo, 'test/fixtures/AtkinsonHyperlegible-Regular.ttf'));
const source = readFileSync(join(repo, 'examples/clock-face.kerf'), 'utf8');
const model = displaySvg(
  render(source, { fonts: { Atkinson: atkinson }, defaultFont: 'Atkinson', margin: 0 }),
  { defs: false, pad: 4 },
)
  .replace('<svg ', '<svg x="640" y="45" width="540" height="540" ')
  .replace(/ role="img"/, '');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
${DISPLAY_DEFS}
<rect width="1200" height="630" fill="#f4f0e7"/>
<line x1="72" y1="560" x2="600" y2="560" stroke="#d6cdbb" stroke-width="2"/>
<g transform="translate(72 92) scale(2.2)">
<rect x="3.5" y="6.5" width="25" height="19" rx="2.5" fill="#e3c69a" stroke="#5a3519"/>
<path d="M3.5 16H19" stroke="#d8361f" stroke-width="1.8" stroke-linecap="round"/>
<circle cx="19" cy="16" r="1.6" fill="#d8361f"/>
</g>
<text x="152" y="140" font-family="IBM Plex Sans Condensed" font-weight="600" font-size="44" fill="#1f1c18">kerfscript</text>
<text font-family="IBM Plex Sans Condensed" font-weight="600" font-size="66" fill="#1f1c18">
<tspan x="72" y="270">A programming</tspan>
<tspan x="72" y="346">language for</tspan>
<tspan x="72" y="422">laser cutting.</tspan>
</text>
<text x="72" y="510" font-family="IBM Plex Mono" font-size="26" fill="#a3291a">$kerf = 0.15;</text>
<text x="72" y="598" font-family="IBM Plex Mono" font-size="22" fill="#7b7467">kerfscript.mylasertools.com</text>
${model}
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
