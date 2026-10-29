// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Writes every part of a model, in the coordinates its program draws it in,
// as JSON for build.py to assemble in Blender. Run from site/:
//   node 3d/export.mjs [slug ...]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { render } from '../../dist/index.js';

const repo = new URL('../../', import.meta.url);
const out = new URL('./.build/', import.meta.url);
mkdirSync(out, { recursive: true });

const font = readFileSync(new URL('test/fixtures/AtkinsonHyperlegible-Regular.ttf', repo));
const all = JSON.parse(readFileSync(new URL('site/models.json', repo), 'utf8')).map((m) => m.file);
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : all;

// A 1 mm square at the origin: its place in the output tells where the
// renderer moved everything, so the parts can be put back.
const MARKER = '__origin';

const r2 = (v) => Math.round(v * 1000) / 1000;

for (const slug of slugs) {
  const source = readFileSync(new URL(`examples/${slug}.kerf`, repo), 'utf8');
  const result = render(`${source}\npart("${MARKER}") rect(1);\n`, {
    fonts: { Atkinson: font },
    defaultFont: 'Atkinson',
    layout: 'none',
    kerf: 0,
  });
  const items = result.sheets.flatMap((s) => s.items);
  const marker = items.find((it) => it.part === MARKER).layers.get('cut').regions[0];
  const sx = Math.min(...marker.map((p) => p[0]));
  const sy = Math.max(...marker.map((p) => p[1]));
  const back = (poly) => poly.map(([x, y]) => [r2(x - sx), r2(sy - y)]);
  const info = new Map(result.parts.map((p) => [p.name, p]));
  const parts = items
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
      };
    });
  writeFileSync(new URL(`${slug}.json`, out), JSON.stringify({ slug, parts }));
  console.log(slug, parts.length, 'parts');
}
