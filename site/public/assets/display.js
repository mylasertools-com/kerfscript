// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Draws a KerfScript render result as cut material: pieces in plywood with
// burnt edges, engraving and score marks on top. Used by the site build and
// by the playground, so pictures on the site are the real output.

const n = (v) => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? '0' : String(r);
};
const d = (p, closed) => `M${p.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}${closed ? 'Z' : ''}`;

export const DISPLAY_DEFS = `<defs>
<filter id="ks-grain" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency="0.012 0.32" numOctaves="3" seed="11" result="noise"/>
<feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.27  0 0 0 0 0.12  0 0 0 0.55 -0.12" result="grain"/>
<feComposite in="grain" in2="SourceGraphic" operator="in" result="clipped"/>
<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="clipped"/></feMerge>
</filter>
<filter id="ks-shadow" x="-5%" y="-5%" width="110%" height="115%">
<feDropShadow dx="0" dy="0.8" stdDeviation="0.9" flood-color="#3b2a17" flood-opacity="0.28"/>
</filter>
</defs>`;

export function displaySvg(result, { pad = 6, gap = 8, defs = true, className = '' } = {}) {
  const modes = new Map(result.layers.map((l) => [l.name, l.mode]));
  const out = [];
  let y0 = pad;
  let width = 0;
  for (const sheet of result.sheets) {
    const pieces = [];
    const cutLines = [];
    const burns = [];
    const burnLines = [];
    const marks = [];
    for (const item of sheet.items) {
      for (const [name, layer] of item.layers) {
        const mode = modes.get(name) ?? 'line';
        if (mode === 'guide') continue;
        if (mode === 'cut') {
          if (layer.regions.length) pieces.push(layer.regions.map((p) => d(p, true)).join(''));
          for (const p of layer.lines) cutLines.push(d(p, false));
        } else if (mode === 'fill') {
          if (layer.regions.length) burns.push(layer.regions.map((p) => d(p, true)).join(''));
          for (const p of layer.lines) burnLines.push(d(p, false));
        } else {
          for (const p of layer.lines) marks.push(d(p, false));
          for (const p of layer.regions) marks.push(d(p, true));
        }
      }
    }
    out.push(`<g transform="translate(${n(pad)} ${n(y0)})">`);
    if (pieces.length) {
      const all = pieces.join('');
      out.push(
        `<path d="${all}" fill="#e3c69a" fill-rule="evenodd" filter="url(#ks-shadow)"/>`,
        `<path d="${all}" fill="#e3c69a" fill-rule="evenodd" filter="url(#ks-grain)"/>`,
      );
    }
    if (burns.length)
      out.push(
        `<path d="${burns.join('')}" fill="#4b2c16" fill-opacity="0.86" fill-rule="evenodd"/>`,
      );
    if (burnLines.length)
      out.push(
        `<path d="${burnLines.join('')}" fill="none" stroke="#4b2c16" stroke-width="0.35" stroke-linecap="round"/>`,
      );
    if (marks.length)
      out.push(
        `<path d="${marks.join('')}" fill="none" stroke="#6e4524" stroke-opacity="0.85" stroke-width="0.32" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
    if (pieces.length)
      out.push(
        `<path d="${pieces.join('')}" fill="none" stroke="#5a3519" stroke-width="0.45" stroke-linejoin="round"/>`,
      );
    if (cutLines.length)
      out.push(
        `<path d="${cutLines.join('')}" fill="none" stroke="#5a3519" stroke-width="0.45" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
    out.push('</g>');
    y0 += sheet.height + gap;
    width = Math.max(width, sheet.width);
  }
  const height = Math.max(1, y0 - gap + pad);
  const w = Math.max(1, width + 2 * pad);
  const cls = className ? ` class="${className}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg"${cls} viewBox="0 0 ${n(w)} ${n(height)}" data-width="${n(width)}" data-height="${n(y0 - gap - pad)}" role="img">${defs ? DISPLAY_DEFS : ''}${out.join('')}</svg>`;
}
