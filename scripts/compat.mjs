// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Opens KerfScript's SVG and DXF output in Inkscape and checks that sizes,
// layers and fills arrive as KerfScript wrote them. Run `npm run build`
// first. Set INKSCAPE to the inkscape(.com) binary if it is not on the
// default Windows path.
//
//   node scripts/compat.mjs

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '../dist/index.js';

const INKSCAPE =
  process.env.INKSCAPE ??
  (process.platform === 'win32' ? 'C:/Program Files/Inkscape/bin/inkscape.com' : 'inkscape');
const PX = 25.4 / 96;
const TOLERANCE = 0.02;
const out = join('out', 'compat');
mkdirSync(out, { recursive: true });
const fonts = { Atkinson: readFileSync('test/fixtures/AtkinsonHyperlegible-Regular.ttf') };

const MODELS = [
  ['calibration-square', 'holes, kerf, engraved text, score'],
  ['kerf-test', 'open slots, engraved text'],
  ['box', 'finger joints, six parts'],
  ['hinge-card', 'open cut lines'],
  ['coaster', 'engraved ring, score circle'],
  ['jigsaw', 'many cut lines'],
];

const inkscape = (...args) =>
  execFileSync(INKSCAPE, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const version = inkscape('--version').trim().split('\n')[0];

function bounds(paths) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const p of paths)
    for (const [, x, y] of p.d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)) {
      x0 = Math.min(x0, +x);
      x1 = Math.max(x1, +x);
      y0 = Math.min(y0, +y);
      y1 = Math.max(y1, +y);
    }
  return [x1 - x0, y1 - y0];
}

function query(file) {
  const rows = inkscape('--query-all', file)
    .trim()
    .split(/\r?\n/)
    .map((l) => l.split(','));
  const [, , , w, h] = rows[0];
  return { width: +w * PX, height: +h * PX, ids: rows.map((r) => r[0]) };
}

const results = [];
for (const [name, covers] of MODELS) {
  const source = readFileSync(`examples/${name}.kerf`, 'utf8');
  const r = render(source, { fonts, sheet: [2000, 2000] });
  const sheet = r.sheets[0];
  const [w, h] = bounds(sheet.paths);
  const svgFile = join(out, `${name}.svg`);
  const dxfFile = join(out, `${name}.dxf`);
  writeFileSync(svgFile, sheet.svg);
  writeFileSync(dxfFile, sheet.dxf);
  const layers = sheet.paths.map((p) => p.name);
  const problems = [];

  const svg = query(svgFile);
  const stroke = 0.1;
  if (Math.abs(svg.width - stroke - w) > TOLERANCE || Math.abs(svg.height - stroke - h) > TOLERANCE)
    problems.push(
      `SVG size ${(svg.width - stroke).toFixed(3)} x ${(svg.height - stroke).toFixed(3)}, expected ${w.toFixed(3)} x ${h.toFixed(3)}`,
    );
  for (const l of layers) if (!svg.ids.includes(l)) problems.push(`SVG layer ${l} missing`);
  const fill = sheet.svg.match(/<g id="engrave"[^>]*>/)?.[0];
  if (layers.includes('engrave') && !/fill="#000000"/.test(fill ?? ''))
    problems.push('SVG engrave layer not filled');

  const converted = join(out, `${name}.dxf.svg`);
  inkscape(dxfFile, '--export-type=svg', `--export-filename=${converted}`);
  const text = readFileSync(converted, 'utf8');
  const dxf = query(converted);
  const dxfStroke = 1 * PX;
  if (
    Math.abs(dxf.width - dxfStroke - w) > TOLERANCE ||
    Math.abs(dxf.height - dxfStroke - h) > TOLERANCE
  )
    problems.push(
      `DXF size ${(dxf.width - dxfStroke).toFixed(3)} x ${(dxf.height - dxfStroke).toFixed(3)}, expected ${w.toFixed(3)} x ${h.toFixed(3)}`,
    );
  for (const l of layers)
    if (!text.includes(`inkscape:label="${l.toUpperCase()}"`))
      problems.push(`DXF layer ${l} missing`);

  results.push({ name, covers, size: `${w.toFixed(2)} x ${h.toFixed(2)} mm`, layers, problems });
}

console.log(`${version}\n`);
for (const r of results)
  console.log(
    `${r.problems.length ? 'FAIL' : 'ok  '} ${r.name.padEnd(20)} ${r.size.padEnd(20)} ${r.layers.join(', ')}${r.problems.map((p) => `\n     ${p}`).join('')}`,
  );
writeFileSync(join(out, 'results.json'), JSON.stringify({ version, results }, null, 2));
process.exitCode = results.some((r) => r.problems.length) ? 1 : 0;
