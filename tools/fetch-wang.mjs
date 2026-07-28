/**
 * Slice a PixelLab Wang tileset BY CORNERS — DEV TOOL.
 *
 * Separate from the batch runner on purpose. Every other PixelLab tool returns
 * an ordered list of images and the runner maps them positionally. A Wang
 * tileset must NOT be read that way: PixelLab's own metadata says so in as many
 * words — "Do NOT slice the spritesheet by index ... indexing positionally is
 * what produces horizontal banding". Each tile is identified by the terrain at
 * its four corners, and its position in the sheet is given by its bounding box.
 *
 * That is the same mistake that made "forest" and "mountain" both come back as
 * pictures of a ploughed field, so it gets its own tool rather than another
 * flag on the one that assumes order.
 *
 *   node tools/fetch-wang.mjs <tileset_id> <out-dir-under-public/art>
 *
 * Files are named by corner mask: NW|NE|SE|SW as bits 1|2|4|8, so `15` is
 * entirely upper terrain and `0` entirely lower — the same encoding the road
 * set uses for its edges, so the two autotilers read alike.
 *
 * Slicing runs in Chromium because the repo has no image library and one is not
 * worth adding for this; a canvas does it exactly.
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const ART_DIR = join(ROOT, 'public', 'art');
const PREINSTALLED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

function token() {
  if (process.env.PIXELLAB_API_KEY) return process.env.PIXELLAB_API_KEY;
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) throw new Error('No PIXELLAB_API_KEY and no .env');
  return readFileSync(envPath, 'utf8').match(/^PIXELLAB_API_KEY=(.+)$/m)[1].trim();
}

const [tilesetId, outDir] = process.argv.slice(2);
if (!tilesetId || !outDir) {
  console.error('usage: fetch-wang.mjs <tileset_id> <out-dir>');
  process.exit(2);
}

const auth = { Authorization: `Bearer ${token()}` };
const base = `https://api.pixellab.ai/mcp/tilesets/${tilesetId}`;

const metaRes = await fetch(`${base}/metadata`, { headers: auth });
if (!metaRes.ok) throw new Error(`metadata: HTTP ${metaRes.status}`);
const meta = await metaRes.json();

const tiles = meta.tileset_data?.tiles ?? [];
if (tiles.length === 0) throw new Error('metadata has no tileset_data.tiles');

const sheetRes = await fetch(`${base}/image`, { headers: auth });
if (!sheetRes.ok) throw new Error(`image: HTTP ${sheetRes.status}`);
const sheet = Buffer.from(await sheetRes.arrayBuffer());

/** Corner bits, matching the road set's edge encoding: NW=1 NE=2 SE=4 SW=8. */
const maskOf = (corners) =>
  (corners.NW === 'upper' ? 1 : 0) +
  (corners.NE === 'upper' ? 2 : 0) +
  (corners.SE === 'upper' ? 4 : 0) +
  (corners.SW === 'upper' ? 8 : 0);

const browser = await chromium
  .launch()
  .catch(() => chromium.launch({ executablePath: PREINSTALLED }));
const page = await browser.newPage();

const cuts = await page.evaluate(
  async ({ sheetB64, boxes }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${sheetB64}`;
    await img.decode();
    const out = [];
    for (const b of boxes) {
      const c = document.createElement('canvas');
      c.width = b.width;
      c.height = b.height;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, b.x, b.y, b.width, b.height, 0, 0, b.width, b.height);
      out.push({ mask: b.mask, data: c.toDataURL('image/png').split(',')[1] });
    }
    return out;
  },
  {
    sheetB64: sheet.toString('base64'),
    boxes: tiles.map((t) => ({ ...t.bounding_box, mask: maskOf(t.corners) })),
  },
);

await browser.close();

mkdirSync(join(ART_DIR, outDir), { recursive: true });
const seen = new Set();

for (const cut of cuts) {
  // A 16-tile set has exactly one tile per corner combination, so a repeat
  // means the corner reading above is wrong — say so rather than overwrite.
  if (seen.has(cut.mask)) console.error(`WARNING: mask ${cut.mask} twice — check corner parsing`);
  seen.add(cut.mask);
  const buf = Buffer.from(cut.data, 'base64');
  writeFileSync(join(ART_DIR, outDir, `${cut.mask}.png`), buf);
  console.log(`  ${String(cut.mask).padStart(2)} -> public/art/${outDir}/${cut.mask}.png (${buf.length}b)`);
}

console.log(`\n${seen.size}/16 corner combinations written`);
if (seen.size !== 16) process.exitCode = 1;
