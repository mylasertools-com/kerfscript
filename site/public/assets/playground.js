// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// The playground: a code editor, settings made from the customizer comments,
// and the cut file, all rendered in the browser.

import { parameters } from './kerfscript.js';
import { displaySvg } from './display.js';
import { highlight } from './highlight.js';
import { buildControls, setInSource } from './controls.js';
import { createEngine } from './engine.js';

const DRAFT = 'kerfscript-playground';
const root = document.querySelector('[data-playground]');
const $ = (sel) => root.querySelector(sel);
const input = $('[data-input]');
const view = $('[data-view]');
const viewPre = view.parentElement;
const consoleBox = $('[data-console]');
const figure = $('[data-figure]');
const sizeNote = $('[data-size]');
const settings = $('[data-settings]');
const partsBox = $('[data-parts]');
const status = $('[data-status]');
const picker = $('[data-examples]');
const svgButton = $('[data-download="svg"]');
const dxfButton = $('[data-download="dxf"]');
const run = createEngine();
const examples = await (await fetch('/assets/examples.json')).json();

let last = null;
let ready = null;
let mode = 'material';
let paramKey = '';
let errorLine = 0;
let timer = 0;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = (v) => String(Math.round(v * 10) / 10);

function paint() {
  const lines = highlight(input.value).split('\n');
  view.innerHTML = lines
    .map((l, i) => `<span class="ln${i + 1 === errorLine ? ' error' : ''}">${l || ' '}</span>`)
    .join('\n');
}

function setReady(result, source) {
  ready = result ? { result, source } : null;
  svgButton.disabled = !ready;
  dxfButton.disabled = !ready?.result.dxf;
}

function current() {
  return ready && ready.source === input.value ? ready.result : null;
}

function edited() {
  setReady(null);
  paint();
  saveDraft();
}

function syncScroll() {
  viewPre.scrollTop = input.scrollTop;
  viewPre.scrollLeft = input.scrollLeft;
}

function saveDraft() {
  try {
    localStorage.setItem(DRAFT, input.value);
  } catch {}
}

function encode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(text) {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function showFigure() {
  if (!last) {
    figure.replaceChildren();
    return;
  }
  figure.innerHTML =
    mode === 'material'
      ? displaySvg(last, { defs: false })
      : last.svg.replace(/^<\?xml[^>]*>\s*/, '').replace(/ width="[^"]+mm" height="[^"]+mm"/, '');
  figure.classList.toggle('laser', mode === 'laser');
}

function updateSettings() {
  let params;
  try {
    params = parameters(input.value).parameters;
  } catch {
    return;
  }
  const key = JSON.stringify(
    params.map((p) => [p.name, p.group, p.caption, p.min, p.max, p.step, p.options, p.type]),
  );
  if (key === paramKey) {
    for (const p of params) {
      const control = settings.querySelector(`#ctl-${CSS.escape(p.name)}`);
      if (!control || document.activeElement === control) continue;
      if (control.type === 'checkbox') control.checked = Boolean(p.initial);
      else if (!Array.isArray(p.initial)) {
        control.value = String(p.initial);
        const out = control.parentElement.querySelector('output');
        if (out) out.textContent = String(p.initial);
      }
    }
    return;
  }
  paramKey = key;
  const values = Object.fromEntries(params.map((p) => [p.name, p.initial]));
  buildControls(settings, params, values, (name, value) => {
    const next = setInSource(input.value, name, value);
    if (next === input.value) return;
    input.value = next;
    edited();
    schedule(60);
  });
  if (!params.length)
    settings.innerHTML =
      '<p class="hint">Add a comment like <code>// [10:1:100]</code> after a top-level variable to get a slider here.</p>';
}

function showConsole(lines) {
  consoleBox.innerHTML = lines.length
    ? lines.map(([cls, text]) => `<p class="${cls}">${esc(text)}</p>`).join('')
    : '<p class="quiet">echo() output, warnings and errors show up here.</p>';
}

async function update() {
  updateSettings();
  status.textContent = 'Rendering…';
  const source = input.value;
  const reply = await run(source, {});
  if (reply.stale || source !== input.value) return;
  const echoes = (reply.ok ? reply.result.echoes : (reply.echoes ?? [])).map((e) => [
    'echo',
    `ECHO: ${e}`,
  ]);
  if (!reply.ok) {
    setReady(null);
    errorLine = reply.line ?? 0;
    paint();
    showConsole([...echoes, ['error', reply.error]]);
    status.textContent = 'Error';
    root.classList.add('has-error');
    return;
  }
  root.classList.remove('has-error');
  if (errorLine) {
    errorLine = 0;
    paint();
  }
  last = reply.result;
  showFigure();
  showConsole([...echoes, ...last.warnings.map((w) => ['warning', `WARNING: ${w}`])]);
  const pieces = last.parts.reduce((s, p) => s + p.qty, 0);
  sizeNote.textContent = `${fmt(last.width)} × ${fmt(last.height)} mm, ${pieces} ${pieces === 1 ? 'piece' : 'pieces'} on ${last.sheets.length} ${last.sheets.length === 1 ? 'sheet' : 'sheets'}`;
  partsBox.innerHTML = last.parts.length
    ? `<table class="parts"><thead><tr><th>Part</th><th>Qty</th><th>Size</th><th>Cut length</th></tr></thead><tbody>${last.parts
        .map(
          (p) =>
            `<tr><td>${esc(p.name)}</td><td>${p.qty}</td><td>${fmt(p.width)} × ${fmt(p.height)} mm</td><td>${fmt(p.cutLength / 1000)} m</td></tr>`,
        )
        .join('')}</tbody></table>`
    : '';
  setReady(last, source);
  status.textContent = `Rendered in ${Math.max(1, Math.round(reply.ms))} ms`;
}

function schedule(delay = 250) {
  clearTimeout(timer);
  timer = setTimeout(update, delay);
}

function load(text) {
  input.value = text;
  setReady(null);
  errorLine = 0;
  paramKey = '';
  input.scrollTop = 0;
  paint();
  syncScroll();
  schedule(0);
}

input.addEventListener('input', () => {
  edited();
  schedule();
});
input.addEventListener('scroll', syncScroll);
input.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
  e.preventDefault();
  input.setRangeText('  ', input.selectionStart, input.selectionEnd, 'end');
  input.dispatchEvent(new Event('input'));
});

picker.addEventListener('change', () => {
  load(examples[picker.value]);
  history.replaceState(null, '', `?model=${picker.value}`);
  saveDraft();
});

for (const tab of root.querySelectorAll('[data-view]'))
  tab.addEventListener('click', () => {
    mode = tab.dataset.view;
    for (const t of root.querySelectorAll('[data-view]'))
      t.setAttribute('aria-selected', String(t === tab));
    showFigure();
  });

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

root
  .querySelector('[data-download="kerf"]')
  .addEventListener('click', () => download('design.kerf', input.value, 'text/plain'));
svgButton.addEventListener('click', () => {
  const result = current();
  if (result) download('design.svg', result.svg, 'image/svg+xml');
});
dxfButton.addEventListener('click', () => {
  const result = current();
  if (result?.dxf) download('design.dxf', result.dxf, 'application/dxf');
});
root.querySelector('[data-share]').addEventListener('click', async (e) => {
  const url = `${location.origin}${location.pathname}#code=${encode(input.value)}`;
  history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url);
    e.target.textContent = 'Link copied';
  } catch {
    e.target.textContent = 'Link in address bar';
  }
  setTimeout(() => (e.target.textContent = 'Copy link'), 2000);
});

const hash = new URLSearchParams(location.hash.slice(1)).get('code');
const model = new URLSearchParams(location.search).get('model');
let start = null;
if (hash) {
  try {
    start = decode(hash);
  } catch {}
}
if (!start && model && examples[model]) {
  start = examples[model];
  picker.value = model;
}
if (!start) {
  try {
    start = localStorage.getItem(DRAFT);
  } catch {}
}
if (!start) {
  start = examples['clock-face'];
  picker.value = 'clock-face';
}
load(start);
