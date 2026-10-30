import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DEFAULT_LIMITS, KerfError, render } from '../dist/index.js';

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
    /str\(\): the text would be longer than the limit of 1000000 characters/,
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

// t(n) is a list that holds the list before it twice: n + 1 lists, but 2^n
// copies of [0] when written out in full
const SHARED = 'function t(n, a = [0]) = n == 0 ? a : t(n - 1, [a, a]);\n';

test('text from lists that share sublists stops at the limit', () => {
  const small = { limits: { maxListLength: 1000 } };
  for (const src of [
    'echo(t(20));',
    'echo(x = t(20));',
    'x = str("a", t(20));',
    'x = join([1, t(20)], ",");',
    'x = contains("abc", t(20));',
  ])
    fails(SHARED + src, /the text would be longer than the limit of 1000 characters/, small);
  const r = render(SHARED + 'echo(t(3)); rect(1);', small);
  assert.equal(r.echoes[0], '[[[[0], [0]], [[0], [0]]], [[[0], [0]], [[0], [0]]]]');
});

test('echo of a list that shares sublists ends in an error under the default limits', () => {
  const start = Date.now();
  fails(
    'function t(n, a=[0]) = n == 0 ? a : t(n-1, [a,a]);\necho(t(25));',
    (e) => e instanceof KerfError && /echo\(\): the text would be longer/.test(e.message),
  );
  assert.ok(Date.now() - start < 5000);
});

test('messages and names show only the start of a long list', () => {
  for (const src of ['rect(t(30));', 'assert(false, t(30));'])
    assert.throws(
      () => render(SHARED + src),
      (e) => e instanceof KerfError && e.message.length < 400 && /\.\.\./.test(e.message),
    );
  const r = render(SHARED + 'part(t(30), qty = t(30)) rect(1); $material = t(30);');
  assert.ok(r.parts[0].name.length < 400 && r.parts[0].material.length < 400);
});

test('comparing lists that share sublists is quick and counts steps', () => {
  const start = Date.now();
  const r = render(
    SHARED +
      'function u(n, a = [1]) = n == 0 ? a : u(n - 1, [a, a]); a = t(32);' +
      'echo(a == a, t(32) == t(32), t(32) != u(32), search([t(30)], [1, [t(30)]])); rect(1);',
  );
  assert.deepEqual(r.echoes, ['true, true, true, 1']);
  assert.ok(Date.now() - start < 5000);
  const many = 'a = [for (i = [0:99]) [i]]; for (j = [0:99]) let (x = a == [each a]) rect(1);';
  fails(many, /Stopped after 5000 steps/, { maxSteps: 5000 });
  render(many, { maxSteps: 50000 });
});

test('comparing and searching long lists counts a step per item', () => {
  const long = 'a = [for (i = [0:99999]) i]; b = [each a];';
  fails(`${long} for (j = [0:99]) let (x = a == b) rect(1);`, /Stopped after/);
  fails(`${long} for (j = [0:99]) let (x = search(-1, a)) rect(1);`, /Stopped after/);
  fails(`${long} for (j = [0:99]) let (x = contains(a, -1)) rect(1);`, /Stopped after/);
  fails(`${long} for (j = [0:99]) let (x = max(a)) rect(1);`, /Stopped after/);
  fails(`${long} for (j = [0:99]) let (x = a * b) rect(1);`, /Stopped after/);
  fails(
    's = str([for (i = [0:99999]) "x"]); for (j = [0:99]) let (x = len(s)) rect(1);',
    /Stopped after/,
  );
  render(`${long} for (j = [0:99]) let (x = len(a), y = a[j] == b[j]) rect(1);`);
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
  const font = readFileSync('fonts/AtkinsonHyperlegible-Regular.ttf');
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
