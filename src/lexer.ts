// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

export type TokenType = 'num' | 'str' | 'id' | 'punct' | 'eof';

export interface Pos {
  line: number;
  col: number;
  offset: number;
}

export interface Token {
  type: TokenType;
  value: string;
  pos: Pos;
}

export interface Comment {
  text: string;
  line: number;
  block: boolean;
  own: boolean;
}

export class KerfError extends Error {
  line?: number;
  col?: number;
  echoes: string[] = [];
  missingFonts?: string[];
  constructor(message: string, pos?: Pos) {
    super(pos ? `${message} (line ${pos.line}, column ${pos.col})` : message);
    this.name = 'KerfError';
    if (pos) {
      this.line = pos.line;
      this.col = pos.col;
    }
  }
}

const PUNCT = [
  '<=',
  '>=',
  '==',
  '!=',
  '&&',
  '||',
  '+',
  '-',
  '*',
  '/',
  '%',
  '^',
  '<',
  '>',
  '!',
  '?',
  ':',
  '=',
  '.',
  ',',
  ';',
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
  '#',
];

export function tokenize(src: string): { tokens: Token[]; comments: Comment[] } {
  const tokens: Token[] = [];
  const comments: Comment[] = [];
  let i = 0;
  let line = 1;
  let lineStart = 0;
  const pos = (): Pos => ({ line, col: i - lineStart + 1, offset: i });
  const advance = (n: number) => {
    for (let k = 0; k < n; k++) {
      if (src[i] === '\n') {
        line++;
        lineStart = i + 1;
      }
      i++;
    }
  };
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
      advance(1);
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      const stop = end < 0 ? src.length : end;
      const own = /^[ \t]*$/.test(src.slice(src.lastIndexOf('\n', i - 1) + 1, i));
      comments.push({ text: src.slice(i + 2, stop).trim(), line, block: false, own });
      i = stop;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const start = pos();
      const end = src.indexOf('*/', i + 2);
      if (end < 0) throw new KerfError('Unclosed block comment', start);
      comments.push({
        text: src.slice(i + 2, end).trim(),
        line: start.line,
        block: true,
        own: true,
      });
      advance(end + 2 - i);
      continue;
    }
    const p = pos();
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i))!;
      tokens.push({ type: 'num', value: m[0], pos: p });
      advance(m[0].length);
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      const m = /^[A-Za-z_$][A-Za-z0-9_]*/.exec(src.slice(i))!;
      tokens.push({ type: 'id', value: m[0], pos: p });
      advance(m[0].length);
      continue;
    }
    if (c === '"') {
      let out = '';
      advance(1);
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\') {
          const n = src[i + 1];
          if (n === 'n') out += '\n';
          else if (n === 't') out += '\t';
          else if (n === 'u') {
            const hex = src.slice(i + 2, i + 6);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new KerfError('Bad \\u escape', pos());
            out += String.fromCharCode(parseInt(hex, 16));
            advance(4);
          } else out += n;
          advance(2);
          continue;
        }
        if (src[i] === '\n') throw new KerfError('Unclosed string', p);
        out += src[i];
        advance(1);
      }
      if (i >= src.length) throw new KerfError('Unclosed string', p);
      advance(1);
      tokens.push({ type: 'str', value: out, pos: p });
      continue;
    }
    if (c === '<' && /^<[A-Za-z0-9_./-]+>/.test(src.slice(i))) {
      const prev = tokens[tokens.length - 1];
      if (prev && prev.type === 'id' && (prev.value === 'use' || prev.value === 'include')) {
        const m = /^<([A-Za-z0-9_./-]+)>/.exec(src.slice(i))!;
        tokens.push({ type: 'str', value: m[1], pos: p });
        advance(m[0].length);
        continue;
      }
    }
    const op = PUNCT.find((s) => src.startsWith(s, i));
    if (!op) throw new KerfError(`Unexpected character "${c}"`, p);
    tokens.push({ type: 'punct', value: op, pos: p });
    advance(op.length);
  }
  tokens.push({ type: 'eof', value: '', pos: pos() });
  return { tokens, comments };
}
