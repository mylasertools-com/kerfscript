// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

import type { Expr, Param } from './ast.js';

export interface Range {
  type: 'range';
  start: number;
  step: number;
  end: number;
}

export interface Closure {
  type: 'function';
  params: Param[];
  body: Expr;
  scope: unknown;
  name?: string;
}

export type Value = number | string | boolean | undefined | Value[] | Range | Closure;

export const isRange = (v: Value): v is Range =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && v.type === 'range';
export const isFn = (v: Value): v is Closure =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && v.type === 'function';
export const isNum = (v: Value): v is number => typeof v === 'number';

export function rangeValues(r: Range, limit: number): number[] {
  const out: number[] = [];
  if (r.step === 0) return out;
  if (r.step > 0 ? r.start > r.end : r.start < r.end) return out;
  const n = Math.floor((r.end - r.start) / r.step + 1e-9) + 1;
  if (n > limit) throw new Error(`Range has ${n} steps, more than the limit of ${limit}`);
  for (let k = 0; k < n; k++) out.push(r.start + k * r.step);
  return out;
}

export function truthy(v: Value): boolean {
  if (v === undefined || v === false || v === 0 || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'number') return !Number.isNaN(v);
  return true;
}

export function equals(a: Value, b: Value): boolean {
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((x, i) => equals(x, b[i]));
  if (isRange(a) && isRange(b)) return a.start === b.start && a.step === b.step && a.end === b.end;
  return a === b;
}

export function typeName(v: Value): string {
  if (v === undefined) return 'undef';
  if (Array.isArray(v)) return 'list';
  if (isRange(v)) return 'range';
  if (isFn(v)) return 'function';
  return typeof v;
}

export function show(v: Value): string {
  if (v === undefined) return 'undef';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number') return fmt(v);
  if (Array.isArray(v)) return `[${v.map(show).join(', ')}]`;
  if (isRange(v)) return `[${fmt(v.start)}:${fmt(v.step)}:${fmt(v.end)}]`;
  if (isFn(v)) return `function(${v.params.map((p) => p.name).join(', ')})`;
  return String(v);
}

export function str(v: Value): string {
  return typeof v === 'string' ? v : show(v);
}

export function fmt(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toPrecision(10)));
}
