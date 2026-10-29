import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DEFAULT_LIMITS, render } from '../dist/index.js';

const fails = (source, pattern, options) => assert.throws(() => render(source, options), pattern);

test('part copies are limited', () => {
  fails('part("p", qty = 100000) rect(1);', /part copies in total/);
  fails('for (i = [0:9999]) part(str(i), qty = 2) rect(1);', /part copies in total/);
  render('part("p", qty = 50) rect(1);');
});

test('circle segments and polygon corners are limited', () => {
  fails('circle(r = 10, $fn = 100000000);', /segments is more than the limit/);
  fails('$fa = 0.000001; $fs = 0.000001; circle(r = 100);', /segments is more than the limit/);
  fails('regular_polygon(n = 100000000);', /corners is more than the limit/);
  fails('star(n = 100000000);', /points is more than the limit/);
});

test('lists and strings are limited', () => {
  fails(
    'function d(l, n) = n <= 0 ? l : d(concat(l, l), n - 1); x = d([1], 40);',
    /a list of \d+ items/,
  );
  fails(
    'function d(s, n) = n <= 0 ? s : d(str(s, s), n - 1); x = d("x", 40);',
    /a string of \d+ characters/,
  );
  fails('p = [for (i = [0:999998]) [i, i]];', /items in all/);
});

test('lists are limited while they are built', () => {
  fails('x = [for (i = [0:9999]) each [0:99999]];', /a list of \d+ items/);
  fails('x = [for (i = [0:99]) [for (j = [0:99999]) j]];', /items in all/);
  fails(
    'function f(n) = n <= 0 ? [] : [for (i = [0:99999]) i, each f(n - 1)]; x = f(1000);',
    /items in all/,
  );
  fails('a = [for (i = [0:2999]) [1]]; b = [[for (i = [0:2999]) 1]]; c = a * b;', /items in all/);
});

test('strings joined with + are limited', () => {
  fails(
    'function d(s, n) = n <= 0 ? s : d(s + s, n - 1); echo(len(d("x", 24)));',
    /a string of \d+ characters/,
  );
  fails('s = str([for (i = [0:99999]) 0]); x = [for (i = [0:999]) s + "!"];', /items in all/);
  render(
    'function j(l, i = 0) = i >= len(l) ? "" : str(l[i], j(l, i + 1)); echo(j([for (i = [0:399]) i]));',
  );
});

test('echo output is limited', () => {
  fails('s = [for (i = [0:99999]) i]; for (i = [0:999]) echo(s);', /items in all/);
});

test('shapes, output and sheets are limited', () => {
  fails('for (i = [0:200000]) translate([i * 2, 0]) rect(1);', /more than 2000000 points/);
  fails('finger_rect([5000, 5000], finger = 0.0001);', /points, the limit/);
  fails('part("p", qty = 9999) circle(r = 5, $fn = 9000);', /The files would have/);
  fails('$sheet = [10, 10]; part("p", qty = 5000) rect(8);', /more than 200 sheets/);
});

test('limits can be changed', () => {
  fails('part("p", qty = 20) rect(1);', /more than 10 part copies/, { limits: { maxParts: 10 } });
  render('circle(r = 10, $fn = 20000);', { limits: { maxSegments: 20000 } });
});

test('every example renders at a quarter of the default limits', () => {
  const font = readFileSync('test/fixtures/AtkinsonHyperlegible-Regular.ttf');
  const limits = Object.fromEntries(
    Object.entries(DEFAULT_LIMITS).map(([k, v]) => [k, Math.ceil(v / 4)]),
  );
  for (const f of readdirSync('examples').filter((f) => f.endsWith('.kerf')))
    render(readFileSync(`examples/${f}`, 'utf8'), {
      fonts: { Atkinson: font },
      defaultFont: 'Atkinson',
      limits,
    });
});
