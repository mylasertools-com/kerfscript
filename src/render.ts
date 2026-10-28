// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

import { Evaluator, type LayerDef } from './evaluator.js';
import { toDxf } from './export/dxf.js';
import { toSvg } from './export/svg.js';
import {
  clipLines,
  intersection,
  layerBounds,
  offset,
  pieces,
  transform,
  union,
  type Layer,
  type Matrix,
  type PartShape,
} from './geometry.js';
import { KerfError } from './lexer.js';
import { parse } from './parser.js';
import { FontBook, type FontSource } from './text.js';
import type { Value } from './values.js';

export interface RenderOptions {
  params?: Record<string, Value>;
  fonts?: Record<string, FontSource>;
  defaultFont?: string;
  resolve?: (path: string) => string | undefined;
  kerf?: number;
  layout?: 'pack' | 'none';
  sheet?: [number, number];
  gap?: number;
  guides?: boolean;
  maxSteps?: number;
}

export interface PartInfo {
  name: string;
  qty: number;
  width: number;
  height: number;
  pieces: number;
  cutLength: number;
  thickness: number;
  kerf: number;
  material: string;
}

export interface Placed {
  part: string;
  copy: number;
  layers: Map<string, Layer>;
  rotated: boolean;
}

export interface Sheet {
  width: number;
  height: number;
  material: string;
  thickness: number;
  items: Placed[];
  svg: string;
  dxf: string;
}

export interface RenderResult {
  sheets: Sheet[];
  svg: string;
  parts: PartInfo[];
  layers: LayerDef[];
  warnings: string[];
  echoes: string[];
}

const perimeter = (p: [number, number][], closed: boolean) => {
  let s = 0;
  for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  if (closed && p.length > 2)
    s += Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]);
  return s;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function render(source: string, options: RenderOptions = {}): RenderResult {
  const { program } = parse(source);
  const fonts = options.fonts ? new FontBook(options.fonts, options.defaultFont) : undefined;
  const ev = new Evaluator({
    overrides: options.params,
    resolve: options.resolve,
    fonts,
    maxSteps: options.maxSteps,
  });
  let res;
  try {
    res = ev.run(program);
  } catch (e) {
    const err =
      e instanceof RangeError && /call stack/i.test(e.message)
        ? new KerfError('Recursion too deep: the program calls itself without stopping')
        : e;
    if (err instanceof KerfError) err.echoes = ev.echoes;
    throw err;
  }
  const g = (name: string) => res.globals.get(name).value;
  const warnings = res.warnings;
  const defs = res.layers;
  const mode = (k: string) => defs.get(k)?.mode ?? 'line';

  const parts: PartShape[] = [...res.shape.parts];
  const free = [...res.shape.layers.values()].some((l) => l.regions.length || l.lines.length);
  if (free)
    parts.unshift({
      name: 'part',
      qty: 1,
      layers: res.shape.layers,
      thickness: Number(g('$thickness')) || 3,
      kerf: Number(g('$kerf')) || 0,
      material: String(g('$material') ?? 'material'),
    });
  if (!parts.length) warnings.push('Nothing to cut: the program made no shapes.');

  const infos: PartInfo[] = [];
  const ready: { info: PartInfo; layers: Map<string, Layer> }[] = [];
  for (const p of parts) {
    const material = union(
      [...p.layers].filter(([k]) => mode(k) === 'cut').flatMap(([, l]) => l.regions),
    );
    const layers = new Map<string, Layer>();
    for (const [k, l] of p.layers) {
      if (mode(k) === 'guide' && !options.guides) continue;
      let regions = union(l.regions);
      let lines = l.lines.filter((x) => x.length >= 2);
      if (mode(k) === 'line' || mode(k) === 'guide') {
        lines = [...lines, ...regions.map((r) => [...r, r[0]])];
        regions = [];
      }
      if (material.length && mode(k) !== 'guide') {
        if (mode(k) !== 'cut') regions = intersection(regions, material);
        lines = clipLines(lines, material, 'inside');
      }
      if (regions.length || lines.length) layers.set(k, { regions, lines });
    }
    const n = pieces(material).length;
    if (n > 1)
      warnings.push(
        `Part "${p.name}" cuts into ${n} separate pieces. Join them, or make them separate parts.`,
      );
    let cutLength = 0;
    for (const [k, l] of layers)
      if (mode(k) === 'cut') {
        for (const r of l.regions) cutLength += perimeter(r, true);
        for (const r of l.lines) cutLength += perimeter(r, false);
      }
    const b = layerBounds(layers) ?? [0, 0, 0, 0];
    const kerf = options.kerf ?? p.kerf;
    const info: PartInfo = {
      name: p.name,
      qty: p.qty,
      width: round2(b[2] - b[0]),
      height: round2(b[3] - b[1]),
      pieces: n,
      cutLength: Math.round(cutLength),
      thickness: p.thickness,
      kerf,
      material: p.material,
    };
    if (kerf > 0)
      for (const [k, l] of layers)
        if (mode(k) === 'cut')
          l.regions = offset(l.regions, kerf / 2, 'round', Math.min(0.01, kerf / 20));
    infos.push(info);
    ready.push({ info, layers });
  }

  const sheetSize = (options.sheet ?? (g('$sheet') as number[])) as [number, number];
  if (
    !Array.isArray(sheetSize) ||
    typeof sheetSize[0] !== 'number' ||
    typeof sheetSize[1] !== 'number'
  )
    throw new KerfError('$sheet must be [width, height]');
  const gap = options.gap ?? Number(g('$gap') ?? 3);
  const layoutMode = options.layout ?? (g('$layout') === 'none' ? 'none' : 'pack');
  const order = [
    'engrave',
    ...[...defs.keys()].filter((k) => !['engrave', 'score', 'cut', 'guide'].includes(k)),
    'score',
    'cut',
    'guide',
  ];
  const layerList = order.map((k) => defs.get(k)!).filter(Boolean);

  const sheets: Sheet[] = [];
  const flipY: Matrix = [1, 0, 0, -1, 0, 0];
  const exportBounds = (layers: Map<string, Layer>) => layerBounds(layers) ?? [0, 0, 0, 0];
  const moved = (layers: Map<string, Layer>, m: Matrix) =>
    transform({ layers, parts: [] }, m).layers;

  if (layoutMode === 'none') {
    const items: Placed[] = [];
    for (const r of ready)
      for (let c = 0; c < r.info.qty; c++)
        items.push({
          part: r.info.name,
          copy: c + 1,
          layers: moved(r.layers, flipY),
          rotated: false,
        });
    const all = new Map<string, Layer>();
    for (const it of items)
      for (const [k, l] of it.layers) {
        const t = all.get(k) ?? { regions: [], lines: [] };
        t.regions.push(...l.regions);
        t.lines.push(...l.lines);
        all.set(k, t);
      }
    const b = exportBounds(all);
    const shift: Matrix = [1, 0, 0, 1, gap - b[0], gap - b[1]];
    for (const it of items) it.layers = moved(it.layers, shift);
    sheets.push(finishSheet(items, b[2] - b[0] + 2 * gap, b[3] - b[1] + 2 * gap, ready[0]?.info));
  } else {
    const groups = new Map<string, typeof ready>();
    for (const r of ready) {
      const key = `${r.info.material}|${r.info.thickness}`;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    for (const group of groups.values()) {
      const [W, H] = sheetSize;
      const queue: {
        info: PartInfo;
        layers: Map<string, Layer>;
        w: number;
        h: number;
        copy: number;
        rotated: boolean;
      }[] = [];
      for (const r of group) {
        let layers = moved(r.layers, flipY);
        let b = exportBounds(layers);
        let w = b[2] - b[0],
          h = b[3] - b[1];
        let rotated = false;
        if ((w > W - 2 * gap || h > H - 2 * gap) && h <= W - 2 * gap && w <= H - 2 * gap) {
          layers = moved(layers, [0, 1, -1, 0, 0, 0]);
          b = exportBounds(layers);
          w = b[2] - b[0];
          h = b[3] - b[1];
          rotated = true;
        }
        if (w > W - 2 * gap || h > H - 2 * gap)
          warnings.push(
            `Part "${r.info.name}" (${round2(w)} x ${round2(h)} mm) is bigger than the ${W} x ${H} mm sheet.`,
          );
        layers = moved(layers, [1, 0, 0, 1, -b[0], -b[1]]);
        for (let c = 0; c < r.info.qty; c++)
          queue.push({ info: r.info, layers, w, h, copy: c + 1, rotated });
      }
      queue.sort((a, b) => b.h - a.h || b.w - a.w);
      let items: Placed[] = [];
      let x = gap,
        y = gap,
        shelf = 0,
        usedW = 0,
        usedH = 0;
      const flush = () => {
        if (items.length)
          sheets.push(
            finishSheet(items, Math.max(usedW + gap, 1), Math.max(usedH + gap, 1), group[0].info),
          );
        items = [];
        x = gap;
        y = gap;
        shelf = 0;
        usedW = 0;
        usedH = 0;
      };
      for (const q of queue) {
        if (x > gap && x + q.w > W - gap) {
          x = gap;
          y += shelf + gap;
          shelf = 0;
        }
        if (items.length && y + q.h > H - gap) flush();
        items.push({
          part: q.info.name,
          copy: q.copy,
          layers: moved(q.layers, [1, 0, 0, 1, x, y]),
          rotated: q.rotated,
        });
        usedW = Math.max(usedW, x + q.w);
        usedH = Math.max(usedH, y + q.h);
        x += q.w + gap;
        shelf = Math.max(shelf, q.h);
      }
      flush();
    }
  }

  function finishSheet(items: Placed[], width: number, height: number, info?: PartInfo): Sheet {
    const w = round2(width),
      h = round2(height);
    return {
      width: w,
      height: h,
      material: info?.material ?? 'material',
      thickness: info?.thickness ?? 0,
      items,
      svg: toSvg(items, w, h, layerList),
      dxf: toDxf(items, w, h, layerList),
    };
  }

  const svg =
    sheets.length === 1
      ? sheets[0].svg
      : toSvg(
          sheets.flatMap((s, i) => {
            const dy = sheets.slice(0, i).reduce((acc, p) => acc + p.height + 10, 0);
            return s.items.map((it) => ({ ...it, layers: moved(it.layers, [1, 0, 0, 1, 0, dy]) }));
          }),
          round2(Math.max(1, ...sheets.map((s) => s.width))),
          round2(
            sheets.reduce((acc, s) => acc + s.height, 0) + 10 * Math.max(0, sheets.length - 1),
          ),
          layerList,
        );

  return { sheets, svg, parts: infos, layers: layerList, warnings, echoes: res.echoes };
}
