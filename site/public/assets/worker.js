// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Runs KerfScript off the main thread, so a slow program never freezes the page.

import { KerfError, render } from './kerfscript.js';

const own = (o, k) => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);

const font = fetch(new URL('./fonts/AtkinsonHyperlegible-Regular.ttf', import.meta.url)).then((r) =>
  r.arrayBuffer(),
);

self.onmessage = async (event) => {
  const { id, source, params, files } = event.data;
  const started = performance.now();
  try {
    const result = render(source, {
      params,
      fonts: { Atkinson: await font },
      defaultFont: 'Atkinson',
      resolve: files ? (p) => own(files, p) ?? own(files, p + '.kerf') : undefined,
    });
    self.postMessage({
      id,
      ok: true,
      ms: performance.now() - started,
      result: {
        sheets: result.sheets.map(({ width, height, material, thickness, items, svg, dxf }) =>
          result.sheets.length > 1
            ? { width, height, material, thickness, items, svg, dxf }
            : { width, height, material, thickness, items },
        ),
        layers: result.layers,
        parts: result.parts,
        warnings: result.warnings,
        echoes: result.echoes,
        width: result.width,
        height: result.height,
        svg: result.svg,
        dxf: result.sheets.length === 1 ? result.sheets[0].dxf : null,
      },
    });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      // A line in the program, not in a library it uses
      line: error instanceof KerfError && !error.file ? error.line : undefined,
      echoes: error instanceof KerfError ? error.echoes : [],
    });
  }
};
