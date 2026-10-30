// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// Where the playground's code comes from: share links, drafts, examples and
// files, with a limit on how long a program may be.

// Longest program the page takes, from a link, a draft or a file
export const MAX_SOURCE = 1_000_000;

function toBase64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const fromBase64 = (text) =>
  Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const piped = async (bytes, stream) =>
  new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

// Decompresses a link's code, stopping at MAX_SOURCE bytes so a short link
// cannot unpack into a huge program
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
    if (size > MAX_SOURCE) {
      await reader.cancel();
      throw new Error('The linked code is too long');
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(await new Blob(chunks).arrayBuffer());
}

// Share links carry the code compressed (#z=), or as it is (#code=) in
// browsers without compression streams. Both kinds open.
export async function encode(text) {
  const bytes = new TextEncoder().encode(text);
  if (typeof CompressionStream === 'undefined') return `code=${toBase64(bytes)}`;
  return `z=${toBase64(await piped(bytes, new CompressionStream('deflate-raw')))}`;
}

export async function decode(hash) {
  const params = new URLSearchParams(hash);
  if (params.get('z')) return inflate(fromBase64(params.get('z')));
  const code = params.get('code');
  if (code && code.length <= (MAX_SOURCE * 4) / 3)
    return new TextDecoder().decode(fromBase64(code));
  return null;
}

// The code to start with: a file the desktop app opened, a shared link, an
// example named in the address, the draft from last time, or the clock face.
// null means "none"; an empty file is an empty design.
export async function startCode({ file, hash, model, examples, draft }) {
  if (file !== null && file !== undefined) return file;
  try {
    const linked = await decode(hash);
    if (linked !== null) return linked;
  } catch {}
  if (model && examples[model]) return examples[model];
  if (draft !== null && draft !== undefined && draft.length <= MAX_SOURCE) return draft;
  return examples['clock-face'];
}
