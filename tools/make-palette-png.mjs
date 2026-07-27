/**
 * Emit a tiny PNG containing only the project palette.
 *
 * PixelLab's `color_image_base64` reads a reference image's COLOURS and forces
 * generated art onto them — only the colours are sampled, so a 16x1 strip is
 * enough. Feeding it this file is what keeps generated art on the
 * parchment-and-ink direction instead of drifting to saturated defaults, and it
 * is far more reliable than naming colours in the prompt.
 *
 * Written by hand rather than via an image library so the repo needs no extra
 * dependency for a 16-pixel image.
 */

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), 'palette-reference.png');

/** Mirrors src/ui/theme.ts. Keep the two in step. */
const PALETTE = [
  '#0d0b09', // ink
  '#2a231c', // ink line
  '#4a3f31', // warm ink
  '#6b5a44', // umber
  '#a4906c', // parchment shadow
  '#bfae8a', // parchment deep
  '#d3c4a2', // parchment dim
  '#e8dcc0', // parchment
  '#a8ab7d', // muted sage — forest
  '#7d8a5e', // deeper moss
  '#c2ab84', // ochre — hills
  '#9c8f76', // stone grey — the pass
  '#a32c28', // crimson
  '#3f6b8f', // steel blue
  '#c9a227', // aged gold
  '#4a7c59', // verdigris
];

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const width = PALETTE.length;

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(1, 4); // height
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // colour type RGBA
// bytes 10-12 stay 0: deflate, adaptive filtering, no interlace

// One scanline: leading filter byte, then RGBA per pixel.
const row = Buffer.alloc(1 + width * 4);
PALETTE.forEach((hex, i) => {
  const n = parseInt(hex.slice(1), 16);
  const o = 1 + i * 4;
  row[o] = (n >> 16) & 0xff;
  row[o + 1] = (n >> 8) & 0xff;
  row[o + 2] = n & 0xff;
  row[o + 3] = 255;
});

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(row)),
  chunk('IEND', Buffer.alloc(0)),
]);

writeFileSync(OUT, png);
console.log(`Wrote ${OUT} (${width}x1, ${png.length} bytes)`);
