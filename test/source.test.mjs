import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SOURCE, decode, encode, startCode } from '../site/public/assets/source.js';

const examples = { 'clock-face': 'circle(50);', box: 'rect(10);' };
const raw = (text) => `code=${Buffer.from(text).toString('base64url')}`;

test('share links carry code there and back', async () => {
  const code = 'width = 40; // [10:100]\nrect([width, 20]);\n';
  assert.equal(await decode(await encode(code)), code);
  assert.equal(await decode(raw(code)), code);
});

test('a short link cannot unpack into a huge program', async () => {
  const link = await encode('a'.repeat(MAX_SOURCE + 1));
  assert.ok(link.length < 10_000, 'it compresses to a short link');
  await assert.rejects(decode(link), /longer than 1,000,000 characters/);
  assert.deepEqual(
    await startCode({ file: null, hash: link, model: null, examples, draft: null }),
    {
      code: examples['clock-face'],
      problem: 'The linked code is longer than 1,000,000 characters',
    },
  );
  await assert.rejects(decode(`code=${'A'.repeat(MAX_SOURCE * 4 + 1)}`), /longer than/);
});

test('links hold as many characters as the editor takes, in any script', async () => {
  // 3 bytes each in UTF-8
  const wide = '刃'.repeat(MAX_SOURCE);
  assert.equal(await decode(await encode(wide)), wide);
  assert.equal(await decode(raw(wide)), wide);
  // Exactly MAX_SOURCE ASCII characters, whose Base64 is not a multiple of 4
  const ascii = 'a'.repeat(MAX_SOURCE);
  assert.equal(await decode(raw(ascii)), ascii);
  await assert.rejects(decode(raw(wide + '刃')), /longer than/);
});

test('a damaged link says so', async () => {
  await assert.rejects(decode('z=AAAA'), /The link is damaged/);
  await assert.rejects(
    decode(`code=${Buffer.from([0xff, 0xfe]).toString('base64url')}`),
    /damaged/,
  );
  const start = await startCode({
    file: null,
    hash: 'z=AAAA',
    model: 'box',
    examples,
    draft: null,
  });
  assert.equal(start.code, 'rect(10);');
  assert.match(start.problem, /damaged/);
});

test('an empty file is an empty design, not a reason to load other code', async () => {
  const start = await startCode({
    file: '',
    hash: await encode('rect(1);'),
    model: 'box',
    examples,
    draft: 'old draft',
  });
  assert.deepEqual(start, { code: '' });
});

test('without a file: a link, then an example, then the draft, then the clock face', async () => {
  const pick = async (o) =>
    (await startCode({ file: null, hash: '', model: null, examples, draft: null, ...o })).code;
  assert.equal(await pick({ hash: await encode('rect(1);'), model: 'box' }), 'rect(1);');
  assert.equal(await pick({ model: 'box', draft: 'x' }), 'rect(10);');
  assert.equal(await pick({ draft: '' }), '');
  assert.equal(await pick({ draft: 'a'.repeat(MAX_SOURCE + 1) }), 'circle(50);');
  assert.equal(await pick({}), 'circle(50);');
});

test('names every object has are not examples', async () => {
  for (const model of ['toString', 'constructor', '__proto__'])
    assert.equal(
      (await startCode({ file: null, hash: '', model, examples, draft: null })).code,
      'circle(50);',
      model,
    );
});

test('without examples, a new design starts from the fallback', async () => {
  const start = await startCode({
    file: null,
    hash: '',
    model: 'box',
    examples: {},
    draft: null,
    fallback: 'rect(1);',
  });
  assert.equal(start.code, 'rect(1);');
});
