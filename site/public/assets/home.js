// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// The live example on the home page: move a slider, the code and the cut
// file change together.

import { parameters } from './kerfscript.js';
import { displaySvg } from './display.js';
import { highlight } from './highlight.js';
import { buildControls, setInSource } from './controls.js';
import { createEngine } from './engine.js';

const demo = document.querySelector('[data-demo]');
if (demo) {
  const run = createEngine();
  const examples = await (await fetch('/assets/examples.json')).json();
  let source = examples[demo.dataset.model];
  const params = parameters(source).parameters;
  const values = Object.fromEntries(params.map((p) => [p.name, p.initial]));
  const codeView = demo.querySelector('.demo-code code');
  const figure = demo.querySelector('[data-figure]');
  const time = demo.querySelector('[data-time]');

  const update = async () => {
    const reply = await run(source, values);
    if (reply.stale || !reply.ok) return;
    figure.innerHTML = displaySvg(reply.result, { defs: false });
    time.textContent = `rendered in ${Math.max(1, Math.round(reply.ms))} ms`;
  };

  buildControls(demo.querySelector('[data-controls]'), params, values, (name, value) => {
    source = setInSource(source, name, value);
    codeView.innerHTML = highlight(source.replace(/\n$/, ''));
    void update();
  });
  void update();
}
