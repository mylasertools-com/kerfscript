// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

import {
  Clipper64,
  ClipType,
  EndType,
  FillRule,
  JoinType,
  PolyTree64,
  inflatePaths,
  union as clipUnion,
  type Path64,
  type Paths64,
} from 'clipper2-ts';

export type Pt = [number, number];
export type Poly = Pt[];
export type Matrix = [number, number, number, number, number, number];

export interface Layer {
  regions: Poly[];
  lines: Poly[];
}

export interface PartShape {
  name: string;
  qty: number;
  layers: Map<string, Layer>;
  thickness: number;
  kerf: number;
  material: string;
}

export interface Shape {
  layers: Map<string, Layer>;
  parts: PartShape[];
}

const SCALE = 10_000;

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export function emptyShape(): Shape {
  return { layers: new Map(), parts: [] };
}

export function regionShape(regions: Poly[], layer = 'cut'): Shape {
  return { layers: new Map([[layer, { regions, lines: [] }]]), parts: [] };
}

export function lineShape(lines: Poly[], layer = 'cut'): Shape {
  return { layers: new Map([[layer, { regions: [], lines }]]), parts: [] };
}

export function isEmpty(s: Shape): boolean {
  if (s.parts.length) return false;
  for (const l of s.layers.values()) if (l.regions.length || l.lines.length) return false;
  return true;
}

const to64 = (polys: Poly[]): Paths64 =>
  polys.map((p) => p.map(([x, y]) => ({ x: Math.round(x * SCALE), y: Math.round(y * SCALE) })));

const from64 = (paths: Paths64): Poly[] =>
  paths.filter((p) => p.length >= 2).map((p) => p.map((q): Pt => [q.x / SCALE, q.y / SCALE]));

export function union(regions: Poly[], fill: 'nonzero' | 'evenodd' = 'nonzero'): Poly[] {
  if (!regions.length) return [];
  const rule = fill === 'evenodd' ? FillRule.EvenOdd : FillRule.NonZero;
  return from64(clipUnion(to64(regions), rule)).filter((p) => p.length >= 3);
}

function boolean(type: ClipType, a: Poly[], b: Poly[]): Poly[] {
  if (!a.length) return [];
  const c = new Clipper64();
  c.addSubject(to64(a));
  if (b.length) c.addClip(to64(b));
  const out: Paths64 = [];
  c.execute(type, FillRule.NonZero, out);
  return from64(out).filter((p) => p.length >= 3);
}

export const difference = (a: Poly[], b: Poly[]) =>
  b.length ? boolean(ClipType.Difference, a, b) : union(a);
export const intersection = (a: Poly[], b: Poly[]) => boolean(ClipType.Intersection, a, b);
export const xor = (a: Poly[], b: Poly[]) => boolean(ClipType.Xor, a, b);

export function clipLines(lines: Poly[], region: Poly[], keep: 'inside' | 'outside'): Poly[] {
  if (!lines.length) return [];
  if (!region.length) return keep === 'outside' ? lines : [];
  const c = new Clipper64();
  c.addOpenSubject(to64(lines));
  c.addClip(to64(region));
  const closed: Paths64 = [];
  const open: Paths64 = [];
  c.execute(
    keep === 'inside' ? ClipType.Intersection : ClipType.Difference,
    FillRule.NonZero,
    closed,
    open,
  );
  return from64(open);
}

export function offset(
  regions: Poly[],
  delta: number,
  join: 'round' | 'miter' | 'square' = 'round',
  arcTolerance = 0.01,
): Poly[] {
  if (!regions.length) return [];
  if (delta === 0) return union(regions);
  const jt =
    join === 'round' ? JoinType.Round : join === 'square' ? JoinType.Square : JoinType.Miter;
  const out = inflatePaths(
    to64(union(regions)),
    delta * SCALE,
    jt,
    EndType.Polygon,
    2,
    arcTolerance * SCALE,
  );
  return from64(out).filter((p) => p.length >= 3);
}

export function strokeLines(lines: Poly[], width: number): Poly[] {
  if (!lines.length || width <= 0) return [];
  const out = inflatePaths(
    to64(lines),
    (width / 2) * SCALE,
    JoinType.Round,
    EndType.Round,
    2,
    0.01 * SCALE,
  );
  return from64(out);
}

export function pieces(regions: Poly[]): Poly[][] {
  if (!regions.length) return [];
  const tree = new PolyTree64();
  const c = new Clipper64();
  c.addSubject(to64(regions));
  c.execute(ClipType.Union, FillRule.NonZero, tree);
  const out: Poly[][] = [];
  const walk = (node: PolyTree64 | any) => {
    for (let i = 0; i < node.count; i++) {
      const child = node.child(i);
      const group: Path64[] = [child.poly];
      for (let k = 0; k < child.count; k++) {
        const hole = child.child(k);
        group.push(hole.poly);
        walk(hole);
      }
      out.push(from64(group));
    }
  };
  walk(tree);
  return out;
}

export function area(p: Poly): number {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
  return -a / 2;
}

export function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export function apply(m: Matrix, [x, y]: Pt): Pt {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function transformLayers(layers: Map<string, Layer>, m: Matrix): Map<string, Layer> {
  const flip = m[0] * m[3] - m[1] * m[2] < 0;
  const out = new Map<string, Layer>();
  for (const [k, l] of layers) {
    out.set(k, {
      regions: l.regions.map((p) => {
        const q = p.map((pt) => apply(m, pt));
        return flip ? q.reverse() : q;
      }),
      lines: l.lines.map((p) => p.map((pt) => apply(m, pt))),
    });
  }
  return out;
}

export function transform(s: Shape, m: Matrix): Shape {
  return {
    layers: transformLayers(s.layers, m),
    parts: s.parts.map((p) => ({ ...p, layers: transformLayers(p.layers, m) })),
  };
}

export function merge(shapes: Shape[]): Shape {
  const out = emptyShape();
  for (const s of shapes) {
    for (const [k, l] of s.layers) {
      const t = out.layers.get(k) ?? { regions: [], lines: [] };
      t.regions.push(...l.regions);
      t.lines.push(...l.lines);
      out.layers.set(k, t);
    }
    out.parts.push(...s.parts);
  }
  return out;
}

export function retag(s: Shape, layer: string): Shape {
  const all: Layer = { regions: [], lines: [] };
  for (const l of s.layers.values()) {
    all.regions.push(...l.regions);
    all.lines.push(...l.lines);
  }
  return { layers: new Map([[layer, all]]), parts: s.parts };
}

export function bounds(polys: Poly[]): [number, number, number, number] | null {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const p of polys)
    for (const [x, y] of p) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  return x0 === Infinity ? null : [x0, y0, x1, y1];
}

export function layerBounds(
  layers: Map<string, Layer>,
  skip?: (name: string) => boolean,
): [number, number, number, number] | null {
  const all: Poly[] = [];
  for (const [k, l] of layers) {
    if (skip?.(k)) continue;
    all.push(...l.regions, ...l.lines);
  }
  return bounds(all);
}

export function hull(points: Pt[]): Poly {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: Pt, a: Pt, b: Pt) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

export function fragments(r: number, fn: number, fa: number, fs: number): number {
  if (r < 1e-9) return 3;
  if (fn > 0) return Math.max(Math.floor(fn), 3);
  return Math.max(Math.ceil(Math.min(360 / fa, (r * 2 * Math.PI) / fs)), 5);
}

export function ellipsePoly(rx: number, ry: number, n: number): Poly {
  const out: Poly = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    out.push([rx * Math.cos(a), ry * Math.sin(a)]);
  }
  return out;
}

export function roundedRect(w: number, h: number, r: number, segs: (r: number) => number): Poly {
  r = Math.min(r, w / 2, h / 2);
  if (r <= 0)
    return [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
    ];
  const n = Math.max(1, Math.ceil(segs(r) / 4));
  const out: Poly = [];
  const corners: [number, number, number][] = [
    [w - r, r, -90],
    [w - r, h - r, 0],
    [r, h - r, 90],
    [r, r, 180],
  ];
  for (const [cx, cy, a0] of corners)
    for (let i = 0; i <= n; i++) {
      const a = ((a0 + (90 * i) / n) * Math.PI) / 180;
      out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  return out;
}
