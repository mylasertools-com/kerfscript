// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Writes every part of a model, in the coordinates its program draws it in,
// as JSON for build.py to assemble in Blender. Run from site/:
//   node 3d/export.mjs [slug ...]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { render } from '../../dist/index.js';

const repo = new URL('../../', import.meta.url);
const out = new URL('./.build/', import.meta.url);
mkdirSync(out, { recursive: true });

const font = readFileSync(new URL('fonts/AtkinsonHyperlegible-Regular.ttf', repo));
const all = JSON.parse(readFileSync(new URL('site/models.json', repo), 'utf8')).map((m) => m.file);
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : all;

// A 1 mm square at the origin: its place in the output tells where the
// renderer moved everything, so the parts can be put back.
const MARKER = '__origin';

const r2 = (v) => Math.round(v * 1000) / 1000;

// Models shown as several copies side by side, each with its own settings.
// Their parts carry the copy's number as variant.
const VARIANTS = {
  'slot-desk-sign': [
    { label: 'HELLO', shape: 'arch', pattern: 'sun', width: 120, height: 110 },
    { label: 'MAKE', shape: 'hex', pattern: 'tiles', width: 150, height: 100 },
    { label: 'DREAM', shape: 'round', pattern: 'stars', width: 125, height: 115 },
    { label: 'GROW', shape: 'arch', pattern: 'leaves', width: 100, height: 140 },
  ],
};

// Models whose own at and rotate place their parts, rendered with these
// settings. Each part carries the matrix the render put it in.
const PLACED = {
  'pocket-owl': { output: 'loose' },
  'pocket-dinosaur': { output: 'loose' },
  'pocket-dragonfly': { output: 'loose' },
};

function partsOf(source, params) {
  const result = render(`${source}\npart("${MARKER}") rect(1);\n`, {
    fonts: { Atkinson: font },
    defaultFont: 'Atkinson',
    params,
    layout: 'none',
    kerf: 0,
  });
  const items = result.sheets.flatMap((s) => s.items);
  const marker = items.find((it) => it.part === MARKER).layers.get('cut').regions[0];
  const sx = Math.min(...marker.map((p) => p[0]));
  const sy = Math.max(...marker.map((p) => p[1]));
  const back = (poly) => poly.map(([x, y]) => [r2(x - sx), r2(sy - y)]);
  const info = new Map(result.parts.map((p) => [p.name, p]));
  const placed = new Map(
    result.assembly.filter((a) => a.placed).map((a) => [`${a.name}#${a.copy}`, a.matrix]),
  );
  return items
    .filter((it) => it.part !== MARKER)
    .map((it) => {
      const get = (k) => it.layers.get(k) ?? { regions: [], lines: [] };
      const p = info.get(it.part);
      return {
        name: it.part,
        copy: it.copy,
        thickness: p.thickness,
        material: p.material,
        cut: get('cut').regions.map(back),
        cutLines: get('cut').lines.map(back),
        engrave: get('engrave').regions.map(back),
        score: get('score').lines.map(back),
        ...(placed.has(`${it.part}#${it.copy}`) && { matrix: placed.get(`${it.part}#${it.copy}`) }),
      };
    });
}

for (const slug of slugs) {
  const source = readFileSync(new URL(`examples/${slug}.kerf`, repo), 'utf8');
  const parts = VARIANTS[slug]
    ? VARIANTS[slug].flatMap((params, variant) =>
        partsOf(source, params).map((p) => ({ ...p, variant })),
      )
    : partsOf(source, PLACED[slug] ?? {});
  writeFileSync(new URL(`${slug}.json`, out), JSON.stringify({ slug, parts }));
  console.log(slug, parts.length, 'parts');
}
