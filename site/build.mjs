// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Builds the kerfscript.mylasertools.com site into site/dist. Every model
// picture is rendered here by the KerfScript in dist/, from examples/.
// Run `npm run build` first.

import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import { LANGUAGE_VERSION, VERSION, parameters, render } from '../dist/index.js';
import { DISPLAY_DEFS, displaySvg } from './assets/display.js';
import { highlight } from './assets/highlight.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(root, 'site');
const out = join(site, 'dist');
const BASE = 'https://kerfscript.mylasertools.com';
const FONT_FILE = 'AtkinsonHyperlegible-Regular.ttf';
const font = readFileSync(join(root, 'test/fixtures', FONT_FILE));
const FONTS = { fonts: { Atkinson: font }, defaultFont: 'Atkinson' };

rmSync(out, { recursive: true, force: true });
const write = (path, text) => {
  const file = join(out, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
};
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/g, '\n');
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const fmt = (v) => (Math.round(v * 10) / 10).toString();

const LOGO = `<svg class="logo-mark" viewBox="0 0 32 32" aria-hidden="true"><rect x="3.5" y="6.5" width="25" height="19" rx="2.5" fill="#e3c69a" stroke="#5a3519"/><path d="M3.5 16H19" stroke="#d8361f" stroke-width="1.8" stroke-linecap="round"/><circle cx="19" cy="16" r="1.6" fill="#d8361f"/></svg>`;

const NAV = [
  ['/models/', 'Models'],
  ['/playground/', 'Playground'],
  ['/docs/', 'Reference'],
  ['/licence/', 'Licence'],
];

function page({ path, title, description, body, scripts = [], wide = false }) {
  const nav = NAV.map(
    ([href, label]) =>
      `<a href="${href}"${path.startsWith(href) ? ' aria-current="page"' : ''}>${label}</a>`,
  ).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${BASE}${path}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${BASE}${path}">
<meta property="og:type" content="website">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Condensed:wght@500;600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap">
<link rel="stylesheet" href="/assets/style.css">
</head>
<body>
<svg class="defs" aria-hidden="true" focusable="false">${DISPLAY_DEFS}</svg>
<header class="site-header">
<div class="bar${wide ? ' wide' : ''}">
<a class="wordmark" href="/">${LOGO}<span>kerfscript</span></a>
<nav>${nav}</nav>
</div>
</header>
<main${wide ? ' class="wide"' : ''}>
${body}
</main>
<footer class="site-footer">
<div class="bar${wide ? ' wide' : ''}">
<p>KerfScript ${VERSION}, language version ${LANGUAGE_VERSION}. Made by <a href="https://mylasertools.com">MyLaserTools</a>.</p>
<p>The interpreter is free software under the GNU AGPL 3.0. What you make with it is yours. <a href="/licence/">Licence</a></p>
<p>KerfScript is a trademark of MyLaserTools.</p>
</div>
</footer>
${scripts.map((s) => `<script type="module" src="${s}"></script>`).join('\n')}
</body>
</html>
`;
}

function code(src, { numbers = false } = {}) {
  const html = highlight(src.replace(/\n$/, ''));
  if (!numbers) return `<pre class="code"><code>${html}</code></pre>`;
  const lines = html.split('\n');
  return `<pre class="code numbered"><code>${lines.map((l) => `<span class="ln">${l || ' '}</span>`).join('\n')}</code></pre>`;
}

function summary(src) {
  const lines = [];
  for (const line of src.split('\n')) {
    const m = /^\/\/\s?(.*)$/.exec(line.trim());
    if (!m) break;
    lines.push(m[1]);
  }
  return lines.join(' ');
}

const marked = new Marked({
  renderer: {
    code({ text, lang }) {
      return lang === 'kerf'
        ? code(text)
        : `<pre class="code plain"><code>${esc(text)}</code></pre>`;
    },
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const id = text
        .replace(/<[^>]+>/g, '')
        .toLowerCase()
        .replace(/&[a-z]+;/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      return `<h${depth} id="${id}">${text}</h${depth}>\n`;
    },
    link({ href, tokens }) {
      const text = this.parser.parseInline(tokens);
      const map = {
        'TRADEMARKS.md': '/licence/#trademark-policy',
        LICENSE: 'https://www.gnu.org/licenses/agpl-3.0.html',
        'COMMERCIAL-LICENSE.md': '/licence/',
        'LANGUAGE.md': '/docs/',
      };
      const target = map[href] ?? (/^https?:|^#|^\//.test(href) ? href : null);
      return target ? `<a href="${esc(target)}">${text}</a>` : text;
    },
  },
});

// Models

// A sheet about as wide as it is tall for the pictures, so many parts do not
// end up in one long row.
function tidySheet(parts) {
  const sizes = parts.flatMap((p) => Array(p.qty).fill(p));
  const area = sizes.reduce((s, p) => s + (p.width + 6) * (p.height + 6), 0);
  const widest = Math.max(...sizes.map((p) => Math.max(p.width, p.height) + 6));
  return [Math.max(widest, Math.sqrt(area) * 1.35), 100000];
}

const manifest = JSON.parse(read('site/models.json'));
const models = manifest.map((m) => {
  const source = read(`examples/${m.file}.kerf`);
  const first = render(source, { ...FONTS, margin: 0, gap: 6 });
  const shown =
    first.parts.length > 1
      ? render(source, { ...FONTS, margin: 0, gap: 6, sheet: tidySheet(first.parts) })
      : first;
  const file = render(source, FONTS);
  if (shown.warnings.length) throw new Error(`${m.file}: ${shown.warnings.join('; ')}`);
  return {
    ...m,
    slug: m.file,
    source,
    summary: summary(source),
    lines: source.trim().split('\n').length,
    params: parameters(source).parameters,
    parts: shown.parts,
    display: displaySvg(shown, { defs: false }),
    width: shown.width,
    height: shown.height,
    laser: file.svg,
    dxf: file.sheets.length === 1 ? file.sheets[0].dxf : null,
  };
});

const card = (m) => `<a class="model-card" href="/models/${m.slug}/">
<figure>${m.display}</figure>
<div class="model-card-text">
<h3>${esc(m.title)}</h3>
<p>${esc(m.summary)}</p>
<p class="meta">${m.lines} lines · ${m.parts.reduce((s, p) => s + p.qty, 0)} ${m.parts.reduce((s, p) => s + p.qty, 0) === 1 ? 'piece' : 'pieces'} · ${fmt(m.width)} × ${fmt(m.height)} mm</p>
</div>
</a>`;

function rangeText(p) {
  if (p.options) return p.options.map((o) => esc(o.name)).join(', ');
  if (p.min !== undefined && p.max !== undefined) return `${p.min} to ${p.max}`;
  if (p.type === 'boolean') return 'on or off';
  return '';
}

for (const m of models) {
  const laser = m.laser
    .replace(/^<\?xml[^>]*>\s*/, '')
    .replace(/ width="[^"]+mm" height="[^"]+mm"/, '');
  const params = m.params.length
    ? `<table class="params"><thead><tr><th>Setting</th><th>Default</th><th>Range</th></tr></thead><tbody>${m.params
        .map(
          (p) =>
            `<tr><td><code>${esc(p.name)}</code>${p.caption ? `<span>${esc(p.caption)}</span>` : ''}</td><td><code>${esc(JSON.stringify(p.initial))}</code></td><td>${rangeText(p)}</td></tr>`,
        )
        .join('')}</tbody></table>`
    : '';
  const parts = `<table class="parts"><thead><tr><th>Part</th><th>Qty</th><th>Size</th></tr></thead><tbody>${m.parts
    .map(
      (p) =>
        `<tr><td>${esc(p.name)}</td><td>${p.qty}</td><td>${fmt(p.width)} × ${fmt(p.height)} mm</td></tr>`,
    )
    .join('')}</tbody></table>`;
  const body = `<p class="crumbs"><a href="/models/">Models</a> / ${esc(m.title)}</p>
<div class="model-head">
<h1>${esc(m.title)}</h1>
<p class="lede">${esc(m.summary)}</p>
</div>
<div class="model-layout">
<section class="model-figure" data-views>
<div class="view-switch" role="tablist" aria-label="View">
<button role="tab" aria-selected="true" data-view="material">Material</button>
<button role="tab" aria-selected="false" data-view="laser">Laser file</button>
</div>
<figure class="sheet" data-panel="material">${m.display}</figure>
<figure class="sheet laser" data-panel="laser" hidden>${laser}</figure>
<p class="figure-note">Rendered by KerfScript ${VERSION} from the source below. ${fmt(m.width)} × ${fmt(m.height)} mm.</p>
</section>
<aside class="model-facts">
<div class="actions">
<a class="button primary" href="/playground/?model=${m.slug}">Open in playground</a>
<a class="button" href="/models/${m.slug}/${m.slug}.kerf" download>${m.slug}.kerf</a>
<a class="button" href="/models/${m.slug}/${m.slug}.svg" download>SVG</a>
${m.dxf ? `<a class="button" href="/models/${m.slug}/${m.slug}.dxf" download>DXF</a>` : ''}
</div>
<h2>Parts</h2>
${parts}
${params ? `<h2>Settings</h2>${params}` : ''}
</aside>
</div>
<section class="source">
<h2>Source <span class="meta">${m.lines} lines</span></h2>
${code(m.source, { numbers: true })}
</section>`;
  write(
    `models/${m.slug}/index.html`,
    page({
      path: `/models/${m.slug}/`,
      title: `${m.title}, made with KerfScript`,
      description: `${m.summary} A parametric laser cutting model written in KerfScript, with source, settings and cut files.`,
      body,
      scripts: ['/assets/views.js'],
    }),
  );
  write(`models/${m.slug}/${m.slug}.kerf`, m.source);
  write(`models/${m.slug}/${m.slug}.svg`, m.laser);
  if (m.dxf) write(`models/${m.slug}/${m.slug}.dxf`, m.dxf);
}

write(
  'models/index.html',
  page({
    path: '/models/',
    title: 'Models made with KerfScript',
    description:
      'Laser cutting models written in KerfScript: boxes, gears, puzzles, signs and more. Every picture is rendered from the source.',
    body: `<div class="page-head">
<h1>Models</h1>
<p class="lede">Each of these is a short KerfScript program. The pictures are rendered from the source when the site is built, so what you see is what the file cuts. Open one to read the code, change its settings in the playground, or download the cut file.</p>
</div>
<div class="model-grid">${models.map(card).join('\n')}</div>`,
  }),
);

// Home

const hero = models.find((m) => m.slug === 'clock-face');
const featured = ['gears', 'box', 'jigsaw', 'snowflake', 'phone-stand', 'sunflower-panel'].map(
  (s) => models.find((m) => m.slug === s),
);

const FEATURES = [
  [
    'Layers',
    'engrave() text("Oak", 12);',
    'Anything inside <code>engrave()</code>, <code>score()</code> or <code>cut()</code> lands on that machine layer. Engraving is clipped to the material, so nothing gets marked over a hole.',
  ],
  [
    'Kerf',
    '$kerf = 0.15;',
    'Cuts are offset by half the beam width when the file is written. Parts come out the size you typed, and holes stay the size of the bolt.',
  ],
  [
    'Parts and sheets',
    'part("lid", qty = 2) lid();',
    'Name the pieces and say how many. KerfScript packs them onto sheets by material and thickness, and turns a part 90° when that makes it fit.',
  ],
  [
    'Joinery',
    'finger_rect([120, 50], "out");',
    'Finger joints, slots, T-slots and living hinges read <code>$thickness</code>. A box drawn for 3 mm plywood still closes when you switch to 6 mm.',
  ],
  [
    'Settings',
    'width = 120; // [40:5:400]',
    "A comment after a variable turns it into a slider or a menu. It is OpenSCAD's customizer format, so tools that read those settings read these.",
  ],
  [
    'Output',
    'kerf render box.kerf -o box.svg',
    'SVG with one layer per operation for LightBurn, xTool Creative Space, Inkscape and RDWorks, and DXF R12 for CAD. Inner cuts come before outer ones.',
  ],
];

write(
  'index.html',
  page({
    path: '/',
    title: 'KerfScript, a programming language for laser cutting',
    description:
      'KerfScript describes laser cut parts as code: cut, score and engrave layers, kerf compensation, finger joints and sheet layout are part of the language.',
    scripts: ['/assets/home.js'],
    body: `<section class="hero">
<div class="hero-text">
<p class="eyebrow">Language version ${LANGUAGE_VERSION}</p>
<h1>A programming language for laser cutting.</h1>
<p class="lede">Describe a part in a few lines of code. KerfScript puts it on cut, score and engrave layers, offsets it for the width of the beam, and lays the pieces out on your sheet. Change a number and you have a new cut file.</p>
<p class="hero-actions"><a class="button primary" href="/playground/">Open the playground</a> <a class="button" href="/models/">See the models</a></p>
<p class="hero-note">If you have written OpenSCAD, you can already read it.</p>
</div>
<div class="hero-demo" data-demo data-model="${hero.slug}">
<div class="demo-tab"><span>${hero.slug}.kerf</span><span class="demo-time" data-time></span></div>
<div class="demo-code">${code(hero.source)}</div>
<div class="demo-controls" data-controls></div>
<figure class="demo-figure" data-figure>${hero.display}</figure>
</div>
</section>

<section class="features">
<h2>What the language knows about lasers</h2>
<dl>
${FEATURES.map(([t, snippet, text]) => `<div><dt>${t}</dt><dd><pre class="code inline"><code>${highlight(snippet)}</code></pre><p>${text}</p></dd></div>`).join('\n')}
</dl>
</section>

<section class="showcase">
<div class="section-head"><h2>Made with KerfScript</h2><a href="/models/">All ${models.length} models</a></div>
<div class="model-grid">${featured.map(card).join('\n')}</div>
</section>

<section class="compare">
<div>
<h2>OpenSCAD syntax, laser output</h2>
<p>Modules, functions, <code>for</code> loops, list comprehensions, <code>children()</code> and <code>$</code> variables work the way OpenSCAD users expect. The difference is what comes out: OpenSCAD makes a solid, KerfScript makes a cut file with the right layers in the right order.</p>
<p>There is no 3D in KerfScript. Everything it has is for flat parts, which keeps programs short. The finger-jointed box on this site is one line once the library is loaded.</p>
</div>
${code(`use <kerf/box>\n\n$thickness = 3;\n$kerf = 0.15;\n\nbox([120, 80, 50], lid = true);`)}
</section>

<section class="where">
<h2>Where it runs</h2>
<div class="where-grid">
<div><h3>In the browser</h3><p>The <a href="/playground/">playground</a> runs the real interpreter in your browser. Your code is not uploaded anywhere.</p></div>
<div><h3>On MyLaserTools</h3><p>Write a generator in the <a href="https://mylasertools.com/generator-studio">Studio</a>, publish it, and anyone can change its settings and download the cut file.</p></div>
<div><h3>On your computer</h3><p>The <code>kerf</code> command renders files to SVG or DXF. Settings can be changed with <code>-D width=200</code>.</p><pre class="code plain"><code>kerf render box.kerf -o box.svg</code></pre></div>
</div>
</section>

<section class="licence-note">
<h2>Free software, with your designs kept yours</h2>
<p>The interpreter is licensed under the GNU AGPL 3.0. The programs you write and the files they produce belong to you, under any licence you choose, including selling them. Companies that want KerfScript inside a closed product can get a commercial licence from MyLaserTools. <a href="/licence/">How the licence works</a></p>
</section>`,
  }),
);

// Reference

const language = marked.parse(read('LANGUAGE.md'));
const toc = [...language.matchAll(/<h([23]) id="([^"]+)">(.*?)<\/h[23]>/g)]
  .map(
    ([, level, id, text]) =>
      `<li class="l${level}"><a href="#${id}">${text.replace(/<[^>]+>/g, '')}</a></li>`,
  )
  .join('');
write(
  'docs/index.html',
  page({
    path: '/docs/',
    title: 'KerfScript language reference',
    description:
      'The KerfScript language reference: values, expressions, modules, layers, parts and sheets, built-in modules and functions, customizer comments and output.',
    body: `<div class="docs">
<nav class="toc" aria-label="Contents"><p>Contents</p><ol>${toc}</ol></nav>
<article class="prose">${language}</article>
</div>`,
  }),
);

// Licence

const licence = marked.parse(read('COMMERCIAL-LICENSE.md'));
const trademarks = marked.parse(read('TRADEMARKS.md'));
write(
  'licence/index.html',
  page({
    path: '/licence/',
    title: 'KerfScript licence',
    description:
      'KerfScript is free software under the GNU AGPL 3.0 with an extra permission that keeps your designs yours. Commercial licences are available.',
    body: `<article class="prose narrow">${licence}<hr>${trademarks}</article>`,
  }),
);

// Playground

write(
  'playground/index.html',
  page({
    path: '/playground/',
    title: 'KerfScript playground',
    description:
      'Write KerfScript in your browser and see the cut file as you type. Change settings, then download SVG or DXF.',
    wide: true,
    scripts: ['/assets/playground.js'],
    body: `<div class="playground" data-playground>
<div class="pg-bar">
<label class="pg-select">Start from <select data-examples>${models.map((m) => `<option value="${m.slug}">${esc(m.title)}</option>`).join('')}</select></label>
<span class="pg-status" data-status aria-live="polite"></span>
<span class="pg-actions">
<button class="button" data-download="kerf">.kerf</button>
<button class="button" data-download="svg">SVG</button>
<button class="button" data-download="dxf">DXF</button>
<button class="button" data-share>Copy link</button>
</span>
</div>
<div class="pg-main">
<div class="pg-editor">
<div class="editor" data-editor>
<pre class="code editor-view" aria-hidden="true"><code data-view></code></pre>
<textarea data-input spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="KerfScript code"></textarea>
</div>
<div class="pg-console" data-console aria-live="polite"></div>
</div>
<div class="pg-side">
<div class="view-switch" role="tablist" aria-label="View">
<button role="tab" aria-selected="true" data-view="material">Material</button>
<button role="tab" aria-selected="false" data-view="laser">Laser file</button>
</div>
<figure class="sheet" data-figure></figure>
<p class="figure-note" data-size></p>
<div class="pg-settings" data-settings></div>
<div class="pg-parts" data-parts></div>
</div>
</div>
</div>`,
  }),
);

// Assets

mkdirSync(join(out, 'assets/fonts'), { recursive: true });
for (const f of [
  'style.css',
  'display.js',
  'highlight.js',
  'views.js',
  'home.js',
  'playground.js',
  'controls.js',
  'worker.js',
  'engine.js',
])
  copyFileSync(join(site, 'assets', f), join(out, 'assets', f));
copyFileSync(join(root, 'dist/index.js'), join(out, 'assets/kerfscript.js'));
copyFileSync(join(root, 'test/fixtures', FONT_FILE), join(out, 'assets/fonts', FONT_FILE));
copyFileSync(join(root, 'test/fixtures/OFL.txt'), join(out, 'assets/fonts/OFL.txt'));
write(
  'assets/examples.json',
  JSON.stringify(Object.fromEntries(models.map((m) => [m.slug, m.source]))),
);
write('favicon.svg', LOGO.replace('class="logo-mark" ', 'xmlns="http://www.w3.org/2000/svg" '));
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`);
const urls = [
  '/',
  '/models/',
  '/playground/',
  '/docs/',
  '/licence/',
  ...models.map((m) => `/models/${m.slug}/`),
];
write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${BASE}${u}</loc></url>`).join('\n')}\n</urlset>\n`,
);
write(
  '404.html',
  page({
    path: '/404',
    title: 'Not found, KerfScript',
    description: 'Page not found.',
    body: `<div class="page-head"><h1>Nothing cut here</h1><p class="lede">That page does not exist. Try the <a href="/models/">models</a> or the <a href="/docs/">reference</a>.</p></div>`,
  }),
);

console.log(`site/dist: ${models.length} models, ${urls.length} pages`);
