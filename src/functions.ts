// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

import {
  equals,
  isFn,
  isNum,
  isRange,
  joinText,
  rangeValues,
  typeName,
  type Value,
} from './values.js';

const RAD = Math.PI / 180;

// maxLength is the most items in a list or characters in a string, and step()
// counts a step of the program
export interface FnCtx {
  maxLength: number;
  step: () => void;
}

type Run = (args: Value[], c: FnCtx) => Value;

export interface Builtin {
  params: string[];
  // Takes any number of values after the parameters
  rest: boolean;
  // The parameters in positional order for this many positional arguments
  order?: (n: number) => string[];
  run: Run;
}

const def = (sig: string, run: Run, order?: (n: number) => string[]): Builtin => ({
  params: sig
    .replace('...', '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean),
  rest: sig.endsWith('...'),
  order,
  run,
});

// Arguments in parameter order: named ones by name, the rest by position
export function bindArgs(f: Builtin, pos: Value[], named: Map<string, Value>): Value[] {
  if (f.rest) {
    const out = [...pos];
    f.params.forEach((p, i) => {
      if (named.has(p)) out[i] = named.get(p);
    });
    return out;
  }
  const order = f.order?.(pos.length) ?? f.params;
  return f.params.map((p) => (named.has(p) ? named.get(p) : pos[order.indexOf(p)]));
}

function text(vs: Value[], sep: string, c: FnCtx, fn: string): string {
  const out = joinText(vs, sep, c.maxLength);
  if (out === undefined)
    throw new Error(
      `${fn}(): the text would be longer than the limit of ${c.maxLength} characters`,
    );
  return out;
}

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

const math1 = (f: (x: number) => number) =>
  def('x', (a) => (typeof a[0] === 'number' ? clean(f(a[0])) : undefined));

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

export const FUNCTIONS: Record<string, Builtin> = {
  abs: math1(Math.abs),
  sign: math1(Math.sign),
  floor: math1(Math.floor),
  ceil: math1(Math.ceil),
  round: math1((x) => (x < 0 ? -Math.round(-x) : Math.round(x))),
  sqrt: math1(Math.sqrt),
  exp: math1(Math.exp),
  ln: math1(Math.log),
  // log(x) is base 10; log(base, x) takes the base first
  log: def(
    'x, base',
    (a) =>
      a[1] === undefined
        ? clean(Math.log10(num(a[0], 'log')))
        : Math.log(num(a[0], 'log')) / Math.log(num(a[1], 'log')),
    (n) => (n >= 2 ? ['base', 'x'] : ['x', 'base']),
  ),
  sin: math1((x) => Math.sin(x * RAD)),
  cos: math1((x) => Math.cos(x * RAD)),
  tan: math1((x) => Math.tan(x * RAD)),
  asin: math1((x) => Math.asin(x) / RAD),
  acos: math1((x) => Math.acos(x) / RAD),
  atan: math1((x) => Math.atan(x) / RAD),
  atan2: def('y, x', (a) => clean(Math.atan2(num(a[0], 'atan2'), num(a[1], 'atan2')) / RAD)),
  pow: def('x, y', (a) => Math.pow(num(a[0], 'pow'), num(a[1], 'pow'))),
  min: def('values...', (a) =>
    minmax(a, (xs) => xs.reduce((m, x) => (x < m ? x : m), Infinity), 'min'),
  ),
  max: def('values...', (a) =>
    minmax(a, (xs) => xs.reduce((m, x) => (x > m ? x : m), -Infinity), 'max'),
  ),
  clamp: def('x, low, high', (a) =>
    Math.min(Math.max(num(a[0], 'clamp'), num(a[1], 'clamp')), num(a[2], 'clamp')),
  ),
  lerp: def('a, b, t', (a) => {
    const t = num(a[2], 'lerp');
    if (Array.isArray(a[0]) && Array.isArray(a[1])) {
      const b = a[1];
      return a[0].map((x, i) => num(x, 'lerp') + (num(b[i], 'lerp') - num(x, 'lerp')) * t);
    }
    return num(a[0], 'lerp') + (num(a[1], 'lerp') - num(a[0], 'lerp')) * t;
  }),
  norm: def('v', (a) =>
    Math.sqrt(list(a[0], 'norm').reduce((s: number, x) => s + num(x, 'norm') ** 2, 0)),
  ),
  cross: def('a, b', (a) => {
    const u = list(a[0], 'cross').map((x) => num(x, 'cross'));
    const v = list(a[1], 'cross').map((x) => num(x, 'cross'));
    if (u.length === 2) return u[0] * v[1] - u[1] * v[0];
    return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  }),
  len: def('value', (a) =>
    typeof a[0] === 'string' ? [...a[0]].length : Array.isArray(a[0]) ? a[0].length : undefined,
  ),
  concat: def('...', (a, c) => {
    const n = a.reduce((s: number, x) => s + (Array.isArray(x) ? x.length : 1), 0);
    if (n > c.maxLength)
      throw new Error(`concat(): a list of ${n} items is more than the limit of ${c.maxLength}`);
    return a.flatMap((x) => (Array.isArray(x) ? x : [x]));
  }),
  reverse: def('value', (a) =>
    typeof a[0] === 'string' ? [...a[0]].reverse().join('') : [...list(a[0], 'reverse')].reverse(),
  ),
  sum: def('values', (a) => list(a[0], 'sum').reduce((s: number, x) => s + num(x, 'sum'), 0)),
  slice: def('value, start, end', (a) => {
    const xs = typeof a[0] === 'string' ? [...a[0]] : list(a[0], 'slice');
    const out = xs.slice(
      num(a[1] ?? 0, 'slice'),
      a[2] === undefined ? undefined : num(a[2], 'slice'),
    );
    return typeof a[0] === 'string' ? out.join('') : out;
  }),
  str: def('...', (a, c) => text(a, '', c, 'str')),
  chr: def('...', (a) =>
    a
      .flatMap((x) => (Array.isArray(x) ? x : [x]))
      .map((x) => String.fromCodePoint(num(x, 'chr')))
      .join(''),
  ),
  ord: def('text', (a) =>
    typeof a[0] === 'string' && a[0].length ? a[0].codePointAt(0) : undefined,
  ),
  upper: def('text', (a) => (typeof a[0] === 'string' ? a[0].toUpperCase() : undefined)),
  lower: def('text', (a) => (typeof a[0] === 'string' ? a[0].toLowerCase() : undefined)),
  split: def('text, separator', (a) =>
    typeof a[0] === 'string' ? a[0].split(typeof a[1] === 'string' ? a[1] : ' ') : undefined,
  ),
  join: def('values, separator', (a, c) =>
    text(list(a[0], 'join'), typeof a[1] === 'string' ? a[1] : '', c, 'join'),
  ),
  search: def('value, list', (a, c) => {
    const xs = typeof a[1] === 'string' ? [...a[1]] : list(a[1], 'search');
    const i = xs.findIndex((x) => equals(x, a[0], c.step));
    return i < 0 ? undefined : i;
  }),
  contains: def('value, item', (a, c) =>
    typeof a[0] === 'string'
      ? a[0].includes(text([a[1]], '', c, 'contains'))
      : list(a[0], 'contains').some((x) => equals(x, a[1], c.step)),
  ),
  lookup: def('x, table', (a) => {
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
  }),
  rands: def('min, max, count, seed', (a) => {
    const lo = num(a[0], 'rands'),
      hi = num(a[1], 'rands'),
      n = num(a[2], 'rands');
    const rnd = seeded(a[3] === undefined ? 1 : num(a[3], 'rands'));
    return Array.from(
      { length: Math.min(Math.max(0, Math.floor(n)), 1_000_000) },
      () => lo + (hi - lo) * rnd(),
    );
  }),
  is_num: def('value', (a) => isNum(a[0]) && !Number.isNaN(a[0])),
  is_string: def('value', (a) => typeof a[0] === 'string'),
  is_bool: def('value', (a) => typeof a[0] === 'boolean'),
  is_list: def('value', (a) => Array.isArray(a[0])),
  is_undef: def('value', (a) => a[0] === undefined),
  is_function: def('value', (a) => isFn(a[0])),
  type_of: def('value', (a) => typeName(a[0])),
};
