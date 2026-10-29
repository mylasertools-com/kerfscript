// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Draws the KerfScript logo with KerfScript: the letters are Anton (OFL)
// set as text and slanted, the squiggle is a stroked path. Every colour is
// a fill layer; this script writes the layers out as one transparent SVG.
//   node brand/brand.mjs        (from site/)
// Writes public/brand/*.svg, transparent PNGs of each, and public/favicon.svg.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { render } from '../../dist/index.js';

const { Resvg } = createRequire(import.meta.url)('@resvg/resvg-js');

const here = new URL('./', import.meta.url);
const out = new URL('../public/brand/', import.meta.url);
mkdirSync(out, { recursive: true });
const font = readFileSync(new URL('Anton-Regular.ttf', here));

export const COLORS = {
  arrow: '#858382',
  shadow: '#f3e7dc',
  kerf: '#c2aea9',
  script: '#f9b876',
};

// Shared KerfScript: letters with slightly rounded corners, slanted, and the
// hand-drawn squiggle with an arrowhead.
const LIB = `
slant = 0.2;
wide = 1.32;
module letters(s, size) multmatrix([[wide, slant, 0], [0, 1, 0]])
  offset(r = size * 0.012) offset(delta = -size * 0.012) text(s, size = size);

// A smooth brush line through the points (a Catmull-Rom curve), w wide
function cr(a, b, c, d, t) = 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t
  + (3 * b - a - 3 * c + d) * t * t * t);
module squiggle(pts, w) {
  n = len(pts);
  ext = concat([pts[0]], pts, [pts[n - 1]]);
  stroke(w) polyline(concat([for (i = [0:n - 2], k = [0:15]) cr(ext[i], ext[i + 1], ext[i + 2], ext[i + 3], k / 16)], [pts[n - 1]]));
}

module arrowhead(tip, arm, w) stroke(w) {
  line(tip, tip - [arm, 0]);
  line(tip, tip - [0, arm]);
}
`;

const VARIANTS = {
  // The full logo, two lines
  logo: {
    box: [-14, -46, 402, 228],
    body: `
      layer("arrow", mode = "fill") {
        squiggle([[-2, 30], [14, -8], [34, -32], [62, -22], [150, 40], [250, 100], [318, 146], [356, 178], [380, 202]], 13);
        arrowhead([384, 206], 40, 13);
      }
      for (dx = [0, 1]) layer(dx ? "kerf" : "shadow", mode = "fill")
        translate(dx ? [0, 0] : [4, -4]) translate([30, 98]) letters("KERF", 100);
      for (dx = [0, 1]) layer(dx ? "script" : "shadow", mode = "fill")
        translate(dx ? [0, 0] : [4, -4]) letters("SCRIPT", 100);
    `,
  },
  // One line, for the site header
  inline: {
    box: [-8, -26, 616, 104],
    body: `
      layer("arrow", mode = "fill") {
        squiggle([[-4, 2], [8, -14], [60, -17], [260, -13], [460, -9], [528, -4], [556, 26], [574, 66], [584, 86]], 9);
        arrowhead([588, 92], 26, 9);
      }
      for (dx = [0, 1]) layer(dx ? "kerf" : "shadow", mode = "fill")
        translate(dx ? [0, 0] : [3, -3]) letters("KERF", 86);
      for (dx = [0, 1]) layer(dx ? "script" : "shadow", mode = "fill")
        translate(dx ? [0, 0] : [3, -3]) translate([text_width("KERF", 86) * wide + 18, 0]) letters("SCRIPT", 86);
    `,
  },
  // The mark alone: a K and an S with the arrow, for icons
  mark: {
    box: [-10, -18, 186, 132],
    body: `
      layer("arrow", mode = "fill") {
        squiggle([[-4, 18], [10, -6], [40, -2], [100, 40], [140, 78], [160, 102]], 12);
        arrowhead([164, 108], 30, 12);
      }
      for (dx = [0, 1]) {
        layer(dx ? "kerf" : "shadow", mode = "fill") translate(dx ? [0, 0] : [3.5, -3.5]) letters("K", 100);
        layer(dx ? "script" : "shadow", mode = "fill") translate(dx ? [0, 0] : [3.5, -3.5]) translate([text_width("K", 100) * wide + 8, 0]) letters("S", 100);
      }
    `,
  },
};

const ORDER = ['arrow', 'shadow', 'kerf', 'script'];

export function draw(name) {
  const v = VARIANTS[name];
  const [x0, y0, x1, y1] = v.box;
  const source = `${LIB}
$fn = 48;
$layout = "none";
cut() translate([${x0}, ${y0}]) rect([${x1 - x0}, ${y1 - y0}]);
${v.body}`;
  const r = render(source, { fonts: { Anton: font }, defaultFont: 'Anton', margin: 0, kerf: 0 });
  if (r.warnings.length) throw new Error(`${name}: ${r.warnings.join('; ')}`);
  const paths = ORDER.map((layer) => {
    const p = r.paths.find((q) => q.name === layer);
    if (!p || !p.regions) return '';
    const opacity = layer === 'shadow' ? ' fill-opacity="0.82"' : '';
    return `<path fill="${COLORS[layer]}"${opacity} fill-rule="evenodd" d="${p.regions}"/>`;
  }).join('\n  ');
  const w = +(x1 - x0).toFixed(2);
  const h = +(y1 - y0).toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 4}" height="${h * 4}">
  <title>KerfScript</title>
  ${paths}
</svg>
`;
}

if (
  import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
  process.argv[1].endsWith('brand.mjs')
) {
  const WIDTHS = { logo: 1600, inline: 1200, mark: 512 };
  for (const name of Object.keys(VARIANTS)) {
    const svg = draw(name);
    writeFileSync(new URL(`${name}.svg`, out), svg);
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTHS[name] } }).render().asPng();
    writeFileSync(new URL(`${name}.png`, out), png);
    if (name === 'mark')
      writeFileSync(
        new URL('../public/favicon.svg', import.meta.url),
        svg.replace(/ width="[^"]+" height="[^"]+"/, ''),
      );
    console.log(name);
  }
}
