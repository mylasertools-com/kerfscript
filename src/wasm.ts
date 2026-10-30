// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Entry point for kerfscript.wasm, a WASI module built with Javy. It reads one
// JSON request from stdin and writes one JSON response to stdout, so any WASI
// runtime (wasmtime, wasmer, wazero, Node's node:wasi, ...) can embed KerfScript.
// See docs/webassembly.md for the request and response formats.

import {
  parameters,
  render,
  KerfError,
  LANGUAGE_VERSION,
  VERSION,
  type RenderOptions,
  type Value,
} from './index.js';
import { withBuiltinFont } from './font.js';

interface JavyIO {
  readSync(fd: number, buf: Uint8Array): number;
  writeSync(fd: number, buf: Uint8Array): number;
}
declare const Javy: JavyIO & { IO?: JavyIO };

interface Request {
  command?: 'render' | 'params' | 'version';
  source?: string;
  params?: Record<string, Value>;
  files?: Record<string, string>;
  fonts?: Record<string, string>;
  defaultFont?: string;
  kerf?: number;
  layout?: 'pack' | 'none';
  sheet?: [number, number];
  gap?: number;
  margin?: number;
  guides?: boolean;
}

const io: JavyIO = Javy.IO ?? Javy;

function readStdin(): string {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const buf = new Uint8Array(65536);
    const n = io.readSync(0, buf);
    if (n <= 0) break;
    chunks.push(buf.subarray(0, n));
    total += n;
  }
  const all = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.length;
  }
  return new TextDecoder().decode(all);
}

function writeStdout(text: string) {
  const bytes = new TextEncoder().encode(text);
  for (let at = 0; at < bytes.length; ) at += io.writeSync(1, bytes.subarray(at));
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64(text: string): Uint8Array {
  const clean = text.replace(/[\s=]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let acc = 0;
  let j = 0;
  for (let i = 0; i < clean.length; i++) {
    const v = B64.indexOf(clean[i]);
    if (v < 0) throw new Error(`Font data is not base64 (character "${clean[i]}").`);
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[j++] = (acc >> bits) & 0xff;
    }
  }
  return out;
}

function handle(req: Request): object {
  const command = req.command ?? 'render';
  if (command === 'version') return { ok: true, version: VERSION, language: LANGUAGE_VERSION };
  if (typeof req.source !== 'string') throw new Error('The request needs "source", a string.');
  if (command === 'params') return { ok: true, ...parameters(req.source) };
  if (command !== 'render')
    throw new Error(`Unknown command "${command}". Use render, params or version.`);
  const files = req.files ?? {};
  const fonts: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(req.fonts ?? {})) fonts[name] = base64(data);
  const opts: RenderOptions = {
    params: req.params,
    fonts: withBuiltinFont(fonts),
    defaultFont: req.defaultFont,
    resolve: (p) => files[p] ?? files[p + '.kerf'],
    kerf: req.kerf,
    layout: req.layout,
    sheet: req.sheet,
    gap: req.gap,
    margin: req.margin,
    guides: req.guides,
  };
  const r = render(req.source, opts);
  return {
    ok: true,
    svg: r.svg,
    width: r.width,
    height: r.height,
    parts: r.parts,
    warnings: r.warnings,
    echoes: r.echoes,
    sheets: r.sheets.map((s) => ({
      width: s.width,
      height: s.height,
      material: s.material,
      thickness: s.thickness,
      svg: s.svg,
      dxf: s.dxf,
    })),
  };
}

let response: object;
try {
  response = handle(JSON.parse(readStdin()) as Request);
} catch (e) {
  response = {
    ok: false,
    error: e instanceof Error ? e.message : String(e),
    echoes: e instanceof KerfError ? e.echoes : [],
  };
}
writeStdout(JSON.stringify(response));
