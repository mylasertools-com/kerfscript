// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

import { equals, isFn, isNum, isRange, rangeValues, str, typeName, type Value } from './values.js';

const RAD = Math.PI / 180;

type Fn = (args: Value[], named: Map<string, Value>) => Value;

function num(v: Value, fn: string): number {
  if (typeof v !== 'number') throw new Error(`${fn}() needs a number, got ${typeName(v)}`);
  return v;
}

function list(v: Value, fn: string): Value[] {
  if (Array.isArray(v)) return v;
  if (isRange(v)) return rangeValues(v, 1_000_000);
  if (typeof v === 'string') return [...v];
  throw new Error(`${fn}() needs a list, got ${typeName(v)}`);
}

const math1 =
  (name: string, f: (x: number) => number): Fn =>
  (a) =>
    typeof a[0] === 'number' ? clean(f(a[0])) : undefined;

function clean(x: number): number {
  const r = Math.round(x);
  return Math.abs(x - r) < 1e-12 ? r : x;
}

function seeded(seed: number) {
  let s = Math.floor(seed) >>> 0 || 0x9e3779b9;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function minmax(a: Value[], pick: (xs: number[]) => number, name: string): Value {
  const xs = a.length === 1 && Array.isArray(a[0]) ? a[0] : a;
  if (!xs.length) return undefined;
  return pick(xs.map((x) => num(x, name)));
}

export const FUNCTIONS: Record<string, Fn> = {
  abs: math1('abs', Math.abs),
  sign: math1('sign', Math.sign),
  floor: math1('floor', Math.floor),
  ceil: math1('ceil', Math.ceil),
  round: math1('round', (x) => (x < 0 ? -Math.round(-x) : Math.round(x))),
  sqrt: math1('sqrt', Math.sqrt),
  exp: math1('exp', Math.exp),
  ln: math1('ln', Math.log),
  log: (a) =>
    a.length === 2
      ? Math.log(num(a[1], 'log')) / Math.log(num(a[0], 'log'))
      : clean(Math.log10(num(a[0], 'log'))),
  sin: math1('sin', (x) => Math.sin(x * RAD)),
  cos: math1('cos', (x) => Math.cos(x * RAD)),
  tan: math1('tan', (x) => Math.tan(x * RAD)),
  asin: math1('asin', (x) => Math.asin(x) / RAD),
  acos: math1('acos', (x) => Math.acos(x) / RAD),
  atan: math1('atan', (x) => Math.atan(x) / RAD),
  atan2: (a) => clean(Math.atan2(num(a[0], 'atan2'), num(a[1], 'atan2')) / RAD),
  pow: (a) => Math.pow(num(a[0], 'pow'), num(a[1], 'pow')),
  min: (a) => minmax(a, (xs) => xs.reduce((m, x) => (x < m ? x : m), Infinity), 'min'),
  max: (a) => minmax(a, (xs) => xs.reduce((m, x) => (x > m ? x : m), -Infinity), 'max'),
  clamp: (a) => Math.min(Math.max(num(a[0], 'clamp'), num(a[1], 'clamp')), num(a[2], 'clamp')),
  lerp: (a) => {
    const t = num(a[2], 'lerp');
    if (Array.isArray(a[0]) && Array.isArray(a[1])) {
      const b = a[1];
      return a[0].map((x, i) => num(x, 'lerp') + (num(b[i], 'lerp') - num(x, 'lerp')) * t);
    }
    return num(a[0], 'lerp') + (num(a[1], 'lerp') - num(a[0], 'lerp')) * t;
  },
  norm: (a) => Math.sqrt(list(a[0], 'norm').reduce((s: number, x) => s + num(x, 'norm') ** 2, 0)),
  cross: (a) => {
    const u = list(a[0], 'cross').map((x) => num(x, 'cross'));
    const v = list(a[1], 'cross').map((x) => num(x, 'cross'));
    if (u.length === 2) return u[0] * v[1] - u[1] * v[0];
    return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  },
  len: (a) =>
    typeof a[0] === 'string' ? [...a[0]].length : Array.isArray(a[0]) ? a[0].length : undefined,
  concat: (a) => a.flatMap((x) => (Array.isArray(x) ? x : [x])),
  reverse: (a) =>
    typeof a[0] === 'string' ? [...a[0]].reverse().join('') : [...list(a[0], 'reverse')].reverse(),
  sum: (a) => list(a[0], 'sum').reduce((s: number, x) => s + num(x, 'sum'), 0),
  slice: (a) => {
    const xs = typeof a[0] === 'string' ? [...a[0]] : list(a[0], 'slice');
    const out = xs.slice(
      num(a[1] ?? 0, 'slice'),
      a[2] === undefined ? undefined : num(a[2], 'slice'),
    );
    return typeof a[0] === 'string' ? out.join('') : out;
  },
  str: (a) => a.map(str).join(''),
  chr: (a) =>
    a
      .flatMap((x) => (Array.isArray(x) ? x : [x]))
      .map((x) => String.fromCodePoint(num(x, 'chr')))
      .join(''),
  ord: (a) => (typeof a[0] === 'string' && a[0].length ? a[0].codePointAt(0) : undefined),
  upper: (a) => (typeof a[0] === 'string' ? a[0].toUpperCase() : undefined),
  lower: (a) => (typeof a[0] === 'string' ? a[0].toLowerCase() : undefined),
  split: (a) =>
    typeof a[0] === 'string' ? a[0].split(typeof a[1] === 'string' ? a[1] : ' ') : undefined,
  join: (a) =>
    list(a[0], 'join')
      .map(str)
      .join(typeof a[1] === 'string' ? a[1] : ''),
  search: (a) => {
    const xs = typeof a[1] === 'string' ? [...a[1]] : list(a[1], 'search');
    const i = xs.findIndex((x) => equals(x, a[0]));
    return i < 0 ? undefined : i;
  },
  contains: (a) =>
    typeof a[0] === 'string'
      ? a[0].includes(str(a[1]))
      : list(a[0], 'contains').some((x) => equals(x, a[1])),
  lookup: (a) => {
    const key = num(a[0], 'lookup');
    const table = list(a[1], 'lookup') as Value[][];
    if (!table.length) return undefined;
    const rows = table
      .map((r) => [num(r[0], 'lookup'), num(r[1], 'lookup')])
      .sort((p, q) => p[0] - q[0]);
    if (key <= rows[0][0]) return rows[0][1];
    for (let i = 1; i < rows.length; i++)
      if (key <= rows[i][0]) {
        const [x0, y0] = rows[i - 1];
        const [x1, y1] = rows[i];
        return y0 + ((key - x0) / (x1 - x0)) * (y1 - y0);
      }
    return rows[rows.length - 1][1];
  },
  rands: (a) => {
    const lo = num(a[0], 'rands'),
      hi = num(a[1], 'rands'),
      n = num(a[2], 'rands');
    const rnd = seeded(a[3] === undefined ? 1 : num(a[3], 'rands'));
    return Array.from(
      { length: Math.min(Math.max(0, Math.floor(n)), 1_000_000) },
      () => lo + (hi - lo) * rnd(),
    );
  },
  is_num: (a) => isNum(a[0]) && !Number.isNaN(a[0]),
  is_string: (a) => typeof a[0] === 'string',
  is_bool: (a) => typeof a[0] === 'boolean',
  is_list: (a) => Array.isArray(a[0]),
  is_undef: (a) => a[0] === undefined,
  is_function: (a) => isFn(a[0]),
  type_of: (a) => typeName(a[0]),
};
