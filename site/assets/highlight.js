// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// KerfScript syntax colouring for the site. It tolerates unfinished code,
// which the playground needs while someone is typing.

const KEYWORDS = new Set([
  'module',
  'function',
  'if',
  'else',
  'for',
  'let',
  'each',
  'use',
  'include',
  'true',
  'false',
  'undef',
]);

const BUILTINS = new Set(
  (
    'rect square circle ellipse regular_polygon star polygon path line polyline arc text ' +
    'translate rotate scale mirror multmatrix union group difference intersection hull offset ' +
    'stroke outline layer part material children echo assert finger_rect finger_holes tslot ' +
    'living_hinge cut engrave score guide box divider ' +
    'abs sign floor ceil round sqrt pow exp ln log sin cos tan asin acos atan atan2 min max clamp ' +
    'lerp norm cross len concat reverse sum slice str chr ord upper lower split join search ' +
    'contains lookup is_num is_string is_bool is_list is_undef is_function type_of rands ' +
    'text_width text_metrics finger_count'
  ).split(' '),
);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const span = (cls, s) => `<span class="t-${cls}">${esc(s)}</span>`;

export function highlight(src) {
  let out = '';
  let i = 0;
  let afterUse = false;
  while (i < src.length) {
    const c = src[i];
    const rest = src.slice(i);
    let m;
    if (c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      const stop = end < 0 ? src.length : end;
      out += span('comment', src.slice(i, stop));
      i = stop;
    } else if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? src.length : end + 2;
      out += span('comment', src.slice(i, stop));
      i = stop;
    } else if (c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"' && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      out += span('string', src.slice(i, j + 1));
      i = j + 1;
    } else if (afterUse && c === '<' && (m = /^<[^>\n]*>?/.exec(rest))) {
      out += span('string', m[0]);
      i += m[0].length;
      afterUse = false;
    } else if ((m = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(rest))) {
      out += span('number', m[0]);
      i += m[0].length;
    } else if ((m = /^\$?[A-Za-z_][A-Za-z0-9_]*/.exec(rest))) {
      const word = m[0];
      const next = src.slice(i + word.length).match(/^\s*\(/);
      if (word[0] === '$') out += span('special', word);
      else if (KEYWORDS.has(word)) out += span('keyword', word);
      else if (next && BUILTINS.has(word)) out += span('builtin', word);
      else if (next) out += span('call', word);
      else out += esc(word);
      afterUse = word === 'use' || word === 'include';
      i += word.length;
    } else {
      out += esc(c);
      if (!/\s/.test(c)) afterUse = false;
      i++;
    }
  }
  return out;
}
