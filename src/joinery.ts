// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

import { difference, type Poly, type Pt } from './geometry.js';

export type Edge = 'out' | 'in' | 'flat';

export function fingerCount(length: number, finger: number): number {
  let n = Math.round(length / finger);
  if (n % 2 === 0) n += length / finger > n ? 1 : -1;
  return Math.max(3, n);
}

const rect = (x0: number, y0: number, x1: number, y1: number): Poly => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

function edgeNotches(length: number, edge: Edge, t: number, finger: number): Poly[] {
  if (edge === 'flat') return [];
  const n = fingerCount(length, finger);
  const seg = length / n;
  const out: Poly[] = [];
  for (let k = 0; k < n; k++) {
    const notch = edge === 'out' ? k % 2 === 1 : k % 2 === 0;
    if (notch) out.push(rect(k * seg, -1, (k + 1) * seg, t));
  }
  return out;
}

export function fingerRect(w: number, h: number, edges: Edge[], t: number, finger: number): Poly[] {
  const place: ((p: Pt) => Pt)[] = [
    ([x, y]) => [x, y],
    ([x, y]) => [w - y, x],
    ([x, y]) => [w - x, h - y],
    ([x, y]) => [y, h - x],
  ];
  const lengths = [w, h, w, h];
  const notches: Poly[] = [];
  edges.forEach((e, i) => {
    for (const n of edgeNotches(lengths[i], e, t, finger)) notches.push(n.map(place[i]));
  });
  return difference([rect(0, 0, w, h)], notches);
}

export function fingerHoles(length: number, edge: Edge, t: number, finger: number): Poly[] {
  const n = fingerCount(length, finger);
  const seg = length / n;
  const out: Poly[] = [];
  for (let k = 0; k < n; k++) {
    const tab = edge === 'out' ? k % 2 === 0 : k % 2 === 1;
    if (tab) out.push(rect(k * seg, -t / 2, (k + 1) * seg, t / 2));
  }
  return out;
}

export function tslot(
  d: number,
  length: number,
  nutW: number,
  nutH: number,
  nutAt: number,
): Poly[] {
  const slot = rect(-d / 2, -1, d / 2, length);
  const nut = rect(-nutW / 2, nutAt, nutW / 2, nutAt + nutH);
  return [slot, nut];
}

export function livingHinge(
  w: number,
  h: number,
  spacing: number,
  bridge: number,
  cut: number,
): Poly[] {
  const lines: Poly[] = [];
  const pitch = cut + bridge;
  const cols = Math.floor(w / spacing);
  const x0 = (w - cols * spacing) / 2;
  for (let i = 0; i <= cols; i++) {
    const x = x0 + i * spacing;
    const offset = i % 2 === 0 ? bridge : bridge - pitch / 2;
    for (let y = offset; y < h; y += pitch) {
      const a = Math.max(y, i % 2 === 0 ? bridge : 0);
      const b = Math.min(y + cut, h - (i % 2 === 0 ? bridge : 0));
      if (b - a >= bridge / 2)
        lines.push([
          [x, a],
          [x, b],
        ]);
    }
  }
  return lines;
}
