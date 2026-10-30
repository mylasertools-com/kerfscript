import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SOURCE, decode, encode, startCode } from '../site/public/assets/source.js';

const examples = { 'clock-face': 'circle(50);', box: 'rect(10);' };

test('share links carry code there and back', async () => {
  const code = 'width = 40; // [10:100]\nrect([width, 20]);\n';
  assert.equal(await decode(await encode(code)), code);
});

test('a short link cannot unpack into a huge program', async () => {
  const link = await encode('a'.repeat(MAX_SOURCE + 1));
  assert.ok(link.length < 10_000, 'it compresses to a short link');
  await assert.rejects(decode(link), /too long/);
  assert.equal(
    await startCode({ file: null, hash: link, model: null, examples, draft: null }),
    examples['clock-face'],
  );
  const raw = `code=${'A'.repeat(Math.ceil((MAX_SOURCE * 4) / 3) + 4)}`;
  assert.equal(await decode(raw), null);
});

test('an empty file is an empty design, not a reason to load other code', async () => {
  const start = await startCode({
    file: '',
    hash: await encode('rect(1);'),
    model: 'box',
    examples,
    draft: 'old draft',
  });
  assert.equal(start, '');
});

test('without a file: a link, then an example, then the draft, then the clock face', async () => {
  const pick = (o) => startCode({ file: null, hash: '', model: null, examples, draft: null, ...o });
  assert.equal(await pick({ hash: await encode('rect(1);'), model: 'box' }), 'rect(1);');
  assert.equal(await pick({ model: 'box', draft: 'x' }), 'rect(10);');
  assert.equal(await pick({ draft: '' }), '');
  assert.equal(await pick({ draft: 'a'.repeat(MAX_SOURCE + 1) }), 'circle(50);');
  assert.equal(await pick({}), 'circle(50);');
});
