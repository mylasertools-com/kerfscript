import test from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../dist/index.js';

const layers = (r) => r.sheets[0].items.map((it) => it.layers);

test('a layer wrapper around a whole part is an error, not a silent cut', () => {
  for (const wrap of ['score()', 'engrave()', 'cut()', 'layer("etch", "line")'])
    assert.throws(() => render(`${wrap} part("plate") rect(20);`), /cannot go on the/);
  const r = render('#part("ghost") rect(20); part("plate") rect(10);', { kerf: 0 });
  assert.equal(r.parts.find((p) => p.name === 'ghost').cutLength, 0);
  assert.equal(r.parts.find((p) => p.name === 'plate').cutLength, 40);
});

test('geometry operations reach inside named parts', () => {
  const r = render('difference() { part("plate") rect(20); translate([5, 5]) rect(10); }', {
    kerf: 0,
  });
  assert.equal(r.parts[0].cutLength, 120);
  const grown = render('offset(delta = 2) part("plate") rect(20);', { kerf: 0 });
  assert.equal(grown.parts[0].width, 24);
});

test('infinite and huge counts end in errors, not endless loops', () => {
  for (const src of [
    'star(n = 1/0);',
    'arc(end = 1/0);',
    'arc(end = 1e9);',
    'part("p", qty = 1/0) rect(1);',
    'rect([1/0, 2]);',
    'polygon([[0, 0], [1/0, 0], [0, 1]]);',
  ])
    assert.throws(() => render(src, { maxSteps: 1000 }), Error, src);
});

test('svg paths: numbers after Z, exponents and drawing on after Z', () => {
  assert.throws(() => render('path("M0 0 L10 0 Z 1");'), /Z takes no numbers/);
  const exp = render('path("M1e2 0 L0 0 L0 10 Z");', { kerf: 0 });
  assert.equal(exp.parts[0].width, 100);
  const after = layers(render('path("M0 0 L10 0 L0 10 Z L5 5");', { kerf: 0 }))[0].get('cut');
  assert.equal(after.lines.length, 1);
  assert.deepEqual(after.lines[0].length, 2);
});

test('long lists work in each, min, max and norm', () => {
  const r = render(
    'echo(len([each [0:200000]])); echo(max([for (i = [0:200000]) i])); echo(min([3, 1, 2]), norm([3, 4])); rect(1);',
  );
  assert.deepEqual(r.echoes, ['200001', '200000', '1, 5']);
});

test('a used library keeps what it includes', () => {
  const files = {
    outer: 'include <inner> module outer() { inner(); }',
    inner: 'k = 2; module inner() { rect(k); }',
    a: 'include <b> module a() { b(); }',
    b: 'include <a> module b() { rect(3); }',
  };
  const resolve = (p) => files[p];
  assert.equal(render('use <outer> outer();', { resolve, kerf: 0 }).parts[0].width, 2);
  assert.equal(render('use <a> a();', { resolve, kerf: 0 }).parts[0].width, 3);
});

test('gap, margin, sheet and kerf must be usable numbers', () => {
  const src = 'part("p", qty = 2) rect(20);';
  for (const opts of [
    { gap: NaN },
    { gap: -10 },
    { margin: -1 },
    { sheet: [0, 100] },
    { kerf: -1 },
  ])
    assert.throws(() => render(src, opts), Error, JSON.stringify(opts));
  assert.throws(() => render('$sheet = [100, 1/0];' + src), /sheet/);
});
