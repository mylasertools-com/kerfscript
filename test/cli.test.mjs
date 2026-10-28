import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'kerfscript-'));
const input = join(dir, 'plate.kerf');
writeFileSync(
  input,
  'width = 40; // [10:100]\nlabel = "x";\necho(width, label);\nrect([width, 20]);\n',
);
const run = (...args) =>
  spawnSync(process.execPath, ['dist/cli.js', ...args], { encoding: 'utf8' });

test('renders an SVG next to the input by default', () => {
  const r = run('render', input);
  assert.equal(r.status, 0, r.stderr);
  assert.match(readFileSync(join(dir, 'plate.svg'), 'utf8'), /width="46mm"/);
  assert.match(r.stderr, /ECHO: 40, x/);
});

test('-D sets parameters as KerfScript values', () => {
  const out = join(dir, 'wide.svg');
  const r = run('render', input, '-o', out, '-D', 'width=80', '-Dlabel="oak"');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /ECHO: 80, oak/);
  assert.match(readFileSync(out, 'utf8'), /width="86mm"/);
});

test('--params reads a JSON file', () => {
  const p = join(dir, 'p.json');
  writeFileSync(p, JSON.stringify({ width: 25 }));
  const r = run('check', input, '--params', p);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /part: 25 x 20 mm/);
});

test('writes DXF', () => {
  const out = join(dir, 'plate.dxf');
  assert.equal(run('render', input, '-o', out).status, 0);
  assert.match(readFileSync(out, 'utf8'), /^0\nSECTION/);
});

test('params prints the customizer JSON', () => {
  const r = run('params', input);
  assert.equal(r.status, 0);
  const json = JSON.parse(r.stdout);
  assert.equal(json.parameters[0].name, 'width');
  assert.equal(json.parameters[0].max, 100);
});

test('reports errors with a position and a non-zero exit', () => {
  const bad = join(dir, 'bad.kerf');
  writeFileSync(bad, 'rect(10);\ncircle(4;\n');
  const r = run('render', bad);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /ERROR: .*line 2/);
});

test('uses libraries next to the file', () => {
  writeFileSync(join(dir, 'tag.kerf'), 'module tag() rect([30, 10], r = 2);\n');
  const main = join(dir, 'main.kerf');
  writeFileSync(main, 'use <tag>\ntag();\n');
  const r = run('check', main);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /30 x 10 mm/);
});
