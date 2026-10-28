// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

import type { LayerDef } from '../evaluator.js';
import { area, type Poly } from '../geometry.js';
import type { Placed } from '../render.js';
import { n } from './svg.js';

const ACI: Record<string, number> = {
  '#ff0000': 1,
  '#ffff00': 2,
  '#00ff00': 3,
  '#00ffff': 4,
  '#0000ff': 5,
  '#ff00ff': 6,
  '#000000': 7,
};

const aci = (color: string) => {
  const hit = ACI[color.toLowerCase()];
  if (hit) return hit;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  if (r > g && r > b) return 1;
  if (g > r && g > b) return 3;
  if (b > r && b > g) return 5;
  return 7;
};

export function toDxf(items: Placed[], _width: number, height: number, layers: LayerDef[]): string {
  const out: string[] = [];
  const g = (code: number, value: string | number) => out.push(String(code), String(value));
  const name = (s: string) => s.toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
  g(0, 'SECTION');
  g(2, 'HEADER');
  g(9, '$ACADVER');
  g(1, 'AC1009');
  g(9, '$INSUNITS');
  g(70, 4);
  g(0, 'ENDSEC');
  g(0, 'SECTION');
  g(2, 'TABLES');
  g(0, 'TABLE');
  g(2, 'LAYER');
  g(70, layers.length);
  for (const l of layers) {
    g(0, 'LAYER');
    g(2, name(l.name));
    g(70, 0);
    g(62, aci(l.color));
    g(6, 'CONTINUOUS');
  }
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');
  g(0, 'SECTION');
  g(2, 'ENTITIES');
  const poly = (layer: string, p: Poly, closed: boolean) => {
    g(0, 'POLYLINE');
    g(8, layer);
    g(66, 1);
    g(10, 0);
    g(20, 0);
    g(30, 0);
    g(70, closed ? 1 : 0);
    for (const [x, y] of p) {
      g(0, 'VERTEX');
      g(8, layer);
      g(10, n(x));
      g(20, n(height - y));
      g(30, 0);
    }
    g(0, 'SEQEND');
    g(8, layer);
  };
  for (const def of layers) {
    const ln = name(def.name);
    const outer: Poly[] = [];
    for (const it of items) {
      const l = it.layers.get(def.name);
      if (!l) continue;
      for (const p of l.lines) poly(ln, p, false);
      for (const p of l.regions) area(p) < 0 ? poly(ln, p, true) : outer.push(p);
    }
    for (const p of outer) poly(ln, p, true);
  }
  g(0, 'ENDSEC');
  g(0, 'EOF');
  return out.join('\n') + '\n';
}
