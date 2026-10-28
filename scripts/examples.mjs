import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { render } from '../dist/index.js';

const font = readFileSync('test/fixtures/AtkinsonHyperlegible-Regular.ttf');
mkdirSync('out', { recursive: true });
for (const name of readdirSync('examples').filter((f) => f.endsWith('.kerf'))) {
  const r = render(readFileSync(`examples/${name}`, 'utf8'), { fonts: { atkinson: font } });
  writeFileSync(`out/${name.replace(/\.kerf$/, '.svg')}`, r.svg);
  const parts = r.parts
    .map((p) => `${p.name}${p.qty > 1 ? ` x${p.qty}` : ''} ${p.width}x${p.height}`)
    .join(', ');
  console.log(`${name}: ${parts}${r.warnings.length ? ` | ${r.warnings.join(' | ')}` : ''}`);
}
