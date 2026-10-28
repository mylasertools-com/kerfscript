import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { render } from '../dist/index.js';

const font = readFileSync(new URL('./fixtures/AtkinsonHyperlegible-Regular.ttf', import.meta.url));
const docs = new URL('../docs/', import.meta.url);

for (const file of readdirSync(docs).filter((f) => f.endsWith('.md'))) {
  const text = readFileSync(new URL(file, docs), 'utf8').replace(/\r\n/g, '\n');
  const blocks = [...text.matchAll(/```kerf\n([\s\S]*?)```/g)].map((m) => m[1]);
  test(`examples in docs/${file} run`, () => {
    blocks.forEach((src, i) => {
      const shapes = !/^(\$?\w+ = [^;]+;\s*)+$/.test(src.trim());
      const r = render(src, { fonts: { Atkinson: font } });
      if (shapes) assert.ok(r.parts.length, `docs/${file} example ${i + 1} made no parts`);
    });
  });
}
