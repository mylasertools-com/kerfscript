// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Where the playground's code comes from: share links, drafts, examples and
// files, with a limit on how long a program may be.

// Longest program the page takes, from a link, a draft or a file, counted
// as the editor counts it (UTF-16 code units, like String.length)
export const MAX_SOURCE = 1_000_000;
// Its size in UTF-8, which is at most 3 bytes for each code unit
const MAX_BYTES = MAX_SOURCE * 3;

const tooLong = `The linked code is longer than ${MAX_SOURCE.toLocaleString('en')} characters`;

// A link's code as text, or an error when it is not UTF-8 or is longer than
// MAX_SOURCE
function text(bytes) {
  const out = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (out.length > MAX_SOURCE) throw new Error(tooLong);
  return out;
}

function toBase64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const fromBase64 = (text) =>
  Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const piped = async (bytes, stream) =>
  new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

// Decompresses a link's code, stopping at MAX_BYTES so a short link cannot
// unpack into a huge program
async function inflate(bytes) {
  const reader = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
    .getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new Error(tooLong);
    }
    chunks.push(value);
  }
  return text(await new Blob(chunks).arrayBuffer());
}

// Share links carry the code compressed (#z=), or as it is (#code=) in
// browsers without compression streams. Both kinds open.
export async function encode(text) {
  const bytes = new TextEncoder().encode(text);
  if (typeof CompressionStream === 'undefined') return `code=${toBase64(bytes)}`;
  return `z=${toBase64(await piped(bytes, new CompressionStream('deflate-raw')))}`;
}

// The code in a share link, null if it has none, or an error when the link
// is damaged or its code too long
export async function decode(hash) {
  const params = new URLSearchParams(hash);
  try {
    if (params.get('z')) return await inflate(fromBase64(params.get('z')));
    const code = params.get('code');
    if (!code) return null;
    // Base64 without padding: 4 characters for every 3 bytes, rounded up
    if (code.length > Math.ceil((MAX_BYTES * 4) / 3)) throw new Error(tooLong);
    return text(fromBase64(code));
  } catch (e) {
    throw new Error(
      e.message === tooLong ? tooLong : 'The link is damaged: its code cannot be read',
    );
  }
}

// The code to start with: a file the desktop app opened, a shared link, an
// example named in the address, the draft from last time, or the clock face.
// null means "none"; an empty file is an empty design. problem says why a
// link could not be opened.
export async function startCode({ file, hash, model, examples, draft }) {
  if (file !== null && file !== undefined) return { code: file };
  let problem;
  try {
    const linked = await decode(hash);
    if (linked !== null) return { code: linked };
  } catch (e) {
    problem = e.message;
  }
  if (model && examples[model]) return { code: examples[model], problem };
  if (draft !== null && draft !== undefined && draft.length <= MAX_SOURCE)
    return { code: draft, problem };
  return { code: examples['clock-face'], problem };
}
