// Copyright (c) 2026 MyLaserTools. SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-MyLaserTools-Commercial

// A ZIP archive of text files, stored without compression, as a Blob.

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function header(size) {
  const buf = new Uint8Array(size);
  const view = new DataView(buf.buffer);
  return {
    buf,
    u16: (at, v) => view.setUint16(at, v, true),
    u32: (at, v) => view.setUint32(at, v, true),
  };
}

export function zip(files, when = new Date()) {
  const enc = new TextEncoder();
  const time = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1);
  const date = ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const { name, text } of files) {
    const path = enc.encode(name);
    const data = enc.encode(text);
    const crc = crc32(data);
    const local = header(30);
    local.u32(0, 0x04034b50);
    local.u16(4, 20);
    local.u16(6, 0x0800);
    local.u16(10, time);
    local.u16(12, date);
    local.u32(14, crc);
    local.u32(18, data.length);
    local.u32(22, data.length);
    local.u16(26, path.length);
    parts.push(local.buf, path, data);
    const entry = header(46);
    entry.u32(0, 0x02014b50);
    entry.u16(4, 20);
    entry.u16(6, 20);
    entry.u16(8, 0x0800);
    entry.u16(12, time);
    entry.u16(14, date);
    entry.u32(16, crc);
    entry.u32(20, data.length);
    entry.u32(24, data.length);
    entry.u16(28, path.length);
    entry.u32(42, offset);
    central.push(entry.buf, path);
    offset += 30 + path.length + data.length;
  }
  const size = central.reduce((s, b) => s + b.length, 0);
  const end = header(22);
  end.u32(0, 0x06054b50);
  end.u16(8, files.length);
  end.u16(10, files.length);
  end.u32(12, size);
  end.u32(16, offset);
  return new Blob([...parts, ...central, end.buf], { type: 'application/zip' });
}
