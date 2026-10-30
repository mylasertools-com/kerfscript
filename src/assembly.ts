// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

import type { Poly } from './geometry.js';

export type Vec3 = [number, number, number];

export interface Placement {
  at: Vec3;
  rotate: Vec3;
}

export interface AssemblyPart {
  name: string;
  copy: number;
  thickness: number;
  matrix: number[];
  outline: Poly[];
}

const RAD = Math.PI / 180;

function multiply(a: number[], b: number[]): number[] {
  const out = new Array(16).fill(0);
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      for (let k = 0; k < 4; k++) out[r * 4 + c] += a[r * 4 + k] * b[k * 4 + c];
  return out;
}

function rotation(axis: 0 | 1 | 2, degrees: number): number[] {
  const c = Math.cos(degrees * RAD);
  const s = Math.sin(degrees * RAD);
  if (axis === 0) return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1];
  if (axis === 1) return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1];
  return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

const clean = (n: number) => (Math.abs(n) < 1e-12 ? 0 : n);

export function placementMatrix(p: Placement): number[] {
  const [ax, ay, az] = p.rotate;
  const r = multiply(rotation(2, az), multiply(rotation(1, ay), rotation(0, ax)));
  r[3] = p.at[0];
  r[7] = p.at[1];
  r[11] = p.at[2];
  return r.map(clean);
}

function apply(m: number[], x: number, y: number, z: number): Vec3 {
  return [
    m[0] * x + m[1] * y + m[2] * z + m[3],
    m[4] * x + m[5] * y + m[6] * z + m[7],
    m[8] * x + m[9] * y + m[10] * z + m[11],
  ];
}

function invertRigid(m: number[]): number[] {
  const [tx, ty, tz] = [m[3], m[7], m[11]];
  const r = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
  return [
    r[0], r[1], r[2], -(r[0] * tx + r[1] * ty + r[2] * tz),
    r[3], r[4], r[5], -(r[3] * tx + r[4] * ty + r[5] * tz),
    r[6], r[7], r[8], -(r[6] * tx + r[7] * ty + r[8] * tz),
    0, 0, 0, 1,
  ];
}

function inside(regions: Poly[], x: number, y: number): boolean {
  let hit = false;
  for (const ring of regions)
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
  return hit;
}

function edgeDistance(regions: Poly[], x: number, y: number): number {
  let best = Infinity;
  for (const ring of regions)
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[j];
      const [bx, by] = ring[i];
      const dx = bx - ax;
      const dy = by - ay;
      const len = dx * dx + dy * dy;
      const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
      best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
    }
  return best;
}

function bounds2(regions: Poly[]): [number, number, number, number] {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const ring of regions)
    for (const [x, y] of ring) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  return [x0, y0, x1, y1];
}

function worldBox(p: AssemblyPart): [Vec3, Vec3] {
  const [x0, y0, x1, y1] = bounds2(p.outline);
  const lo: Vec3 = [Infinity, Infinity, Infinity];
  const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const x of [x0, x1])
    for (const y of [y0, y1])
      for (const z of [0, p.thickness]) {
        const w = apply(p.matrix, x, y, z);
        for (let k = 0; k < 3; k++) {
          lo[k] = Math.min(lo[k], w[k]);
          hi[k] = Math.max(hi[k], w[k]);
        }
      }
  return [lo, hi];
}

const overlaps = (a: [Vec3, Vec3], b: [Vec3, Vec3], eps: number) =>
  [0, 1, 2].every((k) => a[0][k] < b[1][k] - eps && b[0][k] < a[1][k] - eps);

export function collisions(parts: AssemblyPart[], eps = 0.05, samples = 600): [AssemblyPart, AssemblyPart][] {
  const boxes = parts.map(worldBox);
  const inverses = parts.map((p) => invertRigid(p.matrix));
  const found: [AssemblyPart, AssemblyPart][] = [];
  for (let a = 0; a < parts.length; a++) {
    const others = parts.map((_, b) => b).filter((b) => b > a && overlaps(boxes[a], boxes[b], eps));
    if (!others.length) continue;
    const A = parts[a];
    const [x0, y0, x1, y1] = bounds2(A.outline);
    const step = Math.max(0.5, Math.sqrt(((x1 - x0) * (y1 - y0)) / samples));
    const levels = [0.25, 0.5, 0.75].map((f) => A.thickness * f);
    const hits = new Set<number>();
    for (let x = x0 + step / 2; x < x1 && hits.size < others.length; x += step)
      for (let y = y0 + step / 2; y < y1 && hits.size < others.length; y += step) {
        if (!inside(A.outline, x, y) || edgeDistance(A.outline, x, y) <= eps) continue;
        for (const z of levels) {
          const w = apply(A.matrix, x, y, z);
          for (const b of others) {
            if (hits.has(b)) continue;
            const B = parts[b];
            const l = apply(inverses[b], w[0], w[1], w[2]);
            if (l[2] <= eps || l[2] >= B.thickness - eps) continue;
            if (inside(B.outline, l[0], l[1]) && edgeDistance(B.outline, l[0], l[1]) > eps) hits.add(b);
          }
        }
      }
    for (const b of hits) found.push([A, parts[b]]);
  }
  return found;
}
