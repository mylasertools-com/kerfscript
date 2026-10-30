import test from 'node:test';
import assert from 'node:assert/strict';
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WASI } from 'node:wasi';
import { render } from '../dist/index.js';

// Runs dist/kerfscript.wasm the way other hosts do: a WASI runtime with the
// request on stdin and the response on stdout. Build it with `npm run wasm`.
const WASM = 'dist/kerfscript.wasm';
const skip = existsSync(WASM) ? false : 'dist/kerfscript.wasm not built; run npm run wasm';
const dir = mkdtempSync(join(tmpdir(), 'kerfscript-wasm-'));
const module = skip ? null : await WebAssembly.compile(readFileSync(WASM));

async function run(request) {
  const input = join(dir, 'in.json');
  const output = join(dir, 'out.json');
  writeFileSync(input, typeof request === 'string' ? request : JSON.stringify(request));
  const stdin = openSync(input, 'r');
  const stdout = openSync(output, 'w');
  try {
    const wasi = new WASI({ version: 'preview1', stdin, stdout, returnOnExit: true });
    const instance = await WebAssembly.instantiate(module, wasi.getImportObject());
    wasi.start(instance);
  } finally {
    closeSync(stdin);
    closeSync(stdout);
  }
  return JSON.parse(readFileSync(output, 'utf8'));
}

test('reports the version', { skip }, async () => {
  const r = await run({ command: 'version' });
  assert.equal(r.ok, true);
  assert.match(r.version, /^\d+\.\d+\.\d+$/);
});

test('renders the same SVG and DXF as the JavaScript build', { skip }, async () => {
  const source =
    'w = 40;\npart("plate") { difference() { rect([w, 30]); translate([20, 15]) circle(4); } }\n';
  const r = await run({ source, params: { w: 60 }, sheet: [300, 200] });
  assert.equal(r.ok, true, r.error);
  const js = render(source, { params: { w: 60 }, sheet: [300, 200] });
  assert.equal(r.svg, js.svg);
  assert.equal(r.sheets[0].dxf, js.sheets[0].dxf);
  assert.deepEqual(r.parts, js.parts);
});

test('lists customizer parameters', { skip }, async () => {
  const r = await run({
    command: 'params',
    source: 'width = 40; // [10:100]\nrect([width, 20]);\n',
  });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.parameters[0].name, 'width');
  assert.equal(r.parameters[0].max, 100);
});

test('includes come from the files map', { skip }, async () => {
  const r = await run({
    source: 'use <lib/tab>\ntab(12);\n',
    files: { 'lib/tab.kerf': 'module tab(w) { rect([w, 5]); }\n' },
  });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.parts[0].width, 12);
});

test('text() uses base64 fonts', { skip }, async () => {
  const font = readFileSync('fonts/AtkinsonHyperlegible-Regular.ttf');
  const source = 'text("Hi", size = 10);\n';
  const r = await run({ source, fonts: { Atkinson: font.toString('base64') } });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.svg, render(source, { fonts: { Atkinson: font } }).svg);
});

test('text() uses the built-in font when none are given', { skip }, async () => {
  const font = readFileSync('fonts/AtkinsonHyperlegible-Regular.ttf');
  const source = 'text("Hi", size = 10);\n';
  const r = await run({ source });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.svg, render(source, { fonts: { Atkinson: font } }).svg);
});

test('errors come back as JSON with echoes', { skip }, async () => {
  const r = await run({ source: 'echo("before");\nrect([10, 10]\n' });
  assert.equal(r.ok, false);
  assert.match(r.error, /line 3/);
  assert.deepEqual(r.echoes, []);
  const failed = await run({ source: 'echo("before");\nassert(false, "boom");\n' });
  assert.equal(failed.ok, false);
  assert.match(failed.error, /boom/);
  assert.deepEqual(failed.echoes, ['before']);
  const bad = await run('not json');
  assert.equal(bad.ok, false);
});
