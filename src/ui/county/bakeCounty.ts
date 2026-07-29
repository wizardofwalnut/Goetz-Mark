import type { CountyInterior, FieldTile } from '../../domain/county/interior';
import { stageOf } from '../../domain/county/interior';
import {
  overheadFieldArt,
  overheadForestArt,
  overheadGroundArt,
  overheadIndustryArt,
  overheadMountainArt,
  overheadRoadArt,
} from '../../assets/assetManifest';
import { ART_TILE_PX, TOP_FACE_RATIO } from './overheadCamera';
import { toWorld, type WorldPlot } from './worldCamera';

/**
 * Baking a county's static land into flat images.
 *
 * WHY THIS EXISTS. Drawn a tile at a time, the four-county world is roughly 800
 * live <image> elements on one scrolling surface — 800 nodes for the browser to
 * lay out, decode and composite every time the player drags. On a phone that is
 * the wrong shape entirely.
 *
 * But almost none of it moves. Ground, terrain, roads and industry placement
 * never change for the whole match; fields change at most once a season. So the
 * land is composed ONCE into flat bitmaps, exactly the way a side-scroller ships
 * a shop interior as a picture rather than as a thousand placed tiles, and only
 * the handful of things that actually move stay live.
 *
 * FOUR LAYERS PER COUNTY, and each split earns its place:
 *
 *   ground  - grass, water, forest and mountain floor
 *   fields  - the ONLY layer that ever changes, so it re-bakes alone
 *   roads   - drawn over fields, because a road is cut through worked land
 *   props   - forests, mountains and industry: sprites that stand UP
 *
 * `props` is separate for a correctness reason rather than a performance one.
 * The renderer draws every ground layer before any prop layer, because a sprite
 * standing on one row must not be painted over by the ground of the row in
 * front — the bug that once rendered a knight as a head and a flag. Fold props
 * into a county's ground bitmap and that bug comes straight back at every seam,
 * where the next county's bitmap overlaps upward onto this one's bottom row.
 *
 * `fields` is separate for the performance reason: a season advance re-composes
 * sixteen small tiles instead of a county's hundred and fifty.
 */

/** Padding around a county bake, in cells. */
const PAD = 1;

/**
 * Props overhang their cell — a mountain is drawn 1.5 tiles tall, anchored to
 * the bottom of its tile, so it rises above the row it stands on and a wood on
 * the top row reaches past the county's edge. Baking to a tight crop would
 * shear that overhang off at the boundary, leaving a visible straight cut along
 * every seam. One cell of margin all round is enough for the tallest prop.
 */
export const BAKE_PAD_PX = PAD * ART_TILE_PX;

export type LayerName = 'ground' | 'fields' | 'roads' | 'props';

export const LAYER_ORDER: readonly LayerName[] = ['ground', 'fields', 'roads', 'props'];

/** Layers that are painted as flat land, before any standing figure. */
export const GROUND_LAYERS: readonly LayerName[] = ['ground', 'fields', 'roads'];

export interface BakedLayer {
  readonly name: LayerName;
  /** Object URL of the composed bitmap. Revoked when the bake is released. */
  readonly url: string;
}

export interface BakedCounty {
  readonly layers: readonly BakedLayer[];
  /** Native pixel size of each layer bitmap, padding included. */
  readonly width: number;
  readonly height: number;
  /** What the signatures were, so a caller can tell whether to re-bake. */
  readonly signature: LayerSignatures;
  release(): void;
}

export type LayerSignatures = Readonly<Record<LayerName, string>>;

// ---------------------------------------------------------------------------
// Signatures — what decides whether a layer must be composed again.
// ---------------------------------------------------------------------------

/**
 * A layer's cache key.
 *
 * Three of the four are constant for the life of a match: terrain, roads and
 * industry placement are fixed when the interior is generated. Only fields
 * carry live state, so only fields get a content digest.
 *
 * Getting this wrong is expensive in a way that does not show up as a bug — a
 * signature that changes every render silently re-bakes the whole world on
 * every frame and simply feels slow. A test asserts the static three never move.
 */
export function layerSignatures(interior: CountyInterior): LayerSignatures {
  // The interior's own shape. Ground, roads and props are all fixed by it.
  const terrain = `${interior.cols}x${interior.rows}:${interior.ground
    .map((g) => g.kind[0])
    .join('')}`;
  const roads = interior.road.map((c) => `${c.col},${c.row}`).join(';');
  const props = interior.industry.map((s) => `${s.kind}@${s.col},${s.row}`).join(';');
  // Everything a field's ART depends on, and nothing else. Herd size and
  // reclamation progress are deliberately absent: neither changes the tile
  // drawn, so including them would re-bake for a change nobody can see.
  const fields = interior.fields
    .map((f) => `${f.col},${f.row}:${f.status}:${stageOf(f) ?? '-'}`)
    .join(';');

  return { ground: terrain, fields, roads: `${roads}|${terrain}`, props: `${props}|${terrain}` };
}

// ---------------------------------------------------------------------------
// Image loading
// ---------------------------------------------------------------------------

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

/**
 * Decode an art file once and keep it.
 *
 * The set is small and bounded — the manifest holds under fifty overhead
 * entries — and every county reuses the same grass, road and field tiles, so
 * caching turns four counties' worth of loading into one.
 *
 * A failed load resolves to null rather than rejecting: missing art must
 * degrade to a gap in the bake, exactly as `missing` degrades to a fallback in
 * the renderer, and must never take the map down.
 */
function loadImage(url: string): Promise<HTMLImageElement | null> {
  const hit = imageCache.get(url);
  if (hit) return hit;

  const pending = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.decoding = 'sync';
    img.src = url;
  });
  imageCache.set(url, pending);
  return pending;
}

/** Every art file a county's bake will need, loaded before composing starts. */
async function loadFor(interior: CountyInterior, masks: Record<string, number>) {
  const urls = new Set<string>();
  const want = (asset: { url: string | null; missing: boolean }) => {
    if (!asset.missing && asset.url) urls.add(asset.url);
  };

  want(overheadGroundArt('ground'));
  for (const cell of interior.ground) want(overheadGroundArt(cell.kind));
  for (const field of interior.fields) want(overheadFieldArt(field.status, stageOf(field)));
  for (const mask of Object.values(masks)) want(overheadRoadArt(mask));
  for (const site of interior.industry) want(overheadIndustryArt(site.kind));
  want(overheadMountainArt());
  want(overheadForestArt());

  await Promise.all([...urls].map(loadImage));
}

// ---------------------------------------------------------------------------
// Composing
// ---------------------------------------------------------------------------

/**
 * Native-resolution geometry, mirroring overheadCamera exactly.
 *
 * The bake composes at ART_TILE_PX rather than at screen size, so the bitmap is
 * small (a county is 224 x 466 native pixels) and the result is LOSSLESS: the
 * SVG scales the finished bitmap by precisely the factor it would have scaled
 * each individual tile, so baked and unbaked renders are indistinguishable.
 */
const nativeStride = Math.round(ART_TILE_PX * TOP_FACE_RATIO);
const nativeX = (col: number) => col * ART_TILE_PX + BAKE_PAD_PX;
const nativeY = (row: number) => row * nativeStride + BAKE_PAD_PX;

export const bakeSize = (cols: number, rows: number) => ({
  width: cols * ART_TILE_PX + BAKE_PAD_PX * 2,
  height: (rows - 1) * nativeStride + Math.round(ART_TILE_PX * (29 / 32)) + BAKE_PAD_PX * 2,
});

type Ctx = CanvasRenderingContext2D;

/** A tile, drawn at its full canvas so its depth band survives. */
function blitTile(ctx: Ctx, url: string | null, col: number, row: number) {
  if (!url) return;
  const img = ready(url);
  if (img) ctx.drawImage(img, nativeX(col), nativeY(row), ART_TILE_PX, ART_TILE_PX);
}

/**
 * A prop, anchored bottom-centre to its tile's top face — the same rule
 * `MapSprite` follows in the renderer, so a baked wood and a live castle stand
 * on the ground the same way.
 */
function blitProp(ctx: Ctx, url: string | null, col: number, row: number, size: number) {
  if (!url) return;
  const img = ready(url);
  if (!img) return;
  const w = ART_TILE_PX * size;
  const cx = nativeX(col) + ART_TILE_PX / 2;
  const cy = nativeY(row) + nativeStride / 2;
  ctx.drawImage(img, cx - w / 2, cy + nativeStride / 2 - w, w, w);
}

/** Synchronously fetch an already-loaded image. Everything is preloaded first. */
const loaded = new Map<string, HTMLImageElement>();
const ready = (url: string) => loaded.get(url) ?? null;

function canvasOf(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  // Pixel art: never smooth on the way in. Smoothing at bake time would blur
  // the art permanently, where smoothing at draw time is merely a bad frame.
  if (ctx) ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

const toBlobUrl = (canvas: HTMLCanvasElement): Promise<string> =>
  new Promise((resolve) => {
    // A blob URL, NOT a data URL. These bitmaps are a few hundred KB each; as
    // base64 in an href that is megabytes of string for the SVG to re-parse on
    // every render. A blob URL is a short token pointing at bytes the browser
    // already holds.
    canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : ''), 'image/png');
  });

/**
 * Compose one county's four layers.
 *
 * `masks` comes from the WORLD road pass, not from this county alone — that is
 * what makes a road reaching a shared border draw a connecting piece instead of
 * a stub facing its neighbour across the seam.
 */
export async function bakeCounty(
  plot: WorldPlot,
  masks: Record<string, number>,
): Promise<BakedCounty> {
  const { interior, origin } = plot;
  await loadFor(interior, masks);
  // Promote everything that resolved into the synchronous lookup the blitters
  // use, so composing itself never awaits mid-layer and can't tear.
  for (const [url, pending] of imageCache) {
    const img = await pending;
    if (img) loaded.set(url, img);
  }

  const { width, height } = bakeSize(interior.cols, interior.rows);
  const layers: BakedLayer[] = [];

  const compose = async (name: LayerName, draw: (ctx: Ctx) => void) => {
    const { canvas, ctx } = canvasOf(width, height);
    if (!ctx) return;
    draw(ctx);
    layers.push({ name, url: await toBlobUrl(canvas) });
  };

  await compose('ground', (ctx) => {
    const base = overheadGroundArt('ground');
    for (const cell of interior.ground) {
      // Plain ground goes under EVERY cell before its terrain. Generated tiles
      // are not guaranteed to fill their canvas — the water tile came back with
      // a transparent lower band — and without something beneath it the hole
      // shows the page through the map.
      blitTile(ctx, base.url, cell.col, cell.row);
      if (cell.kind !== 'ground') {
        blitTile(ctx, overheadGroundArt(cell.kind).url, cell.col, cell.row);
      }
    }
  });

  await compose('fields', (ctx) => {
    for (const field of interior.fields) {
      blitTile(ctx, overheadFieldArt(field.status, stageOf(field)).url, field.col, field.row);
    }
  });

  await compose('roads', (ctx) => {
    for (const cell of interior.road) {
      const world = toWorld(origin, cell);
      const mask = masks[`${world.col},${world.row}`];
      if (mask === undefined) continue;
      blitTile(ctx, overheadRoadArt(mask).url, cell.col, cell.row);
    }
  });

  await compose('props', (ctx) => {
    // Flattened to one list of drawable props first, so row-sorting sorts the
    // things being drawn rather than two collections that happen to both have a
    // `kind` field. Forest and mountain are ground kinds; quarry and mine are
    // industry kinds; a union keyed on `kind` would quietly conflate them.
    const props: { col: number; row: number; url: string | null; size: number }[] = [];
    for (const cell of interior.ground) {
      if (cell.kind === 'forest') {
        props.push({ col: cell.col, row: cell.row, url: overheadForestArt().url, size: 1.4 });
      } else if (cell.kind === 'mountain') {
        props.push({ col: cell.col, row: cell.row, url: overheadMountainArt().url, size: 1.5 });
      }
    }
    for (const site of interior.industry) {
      props.push({
        col: site.col,
        row: site.row,
        url: overheadIndustryArt(site.kind).url,
        size: 1.15,
      });
    }

    // Row order, so a prop in front overlaps the one behind it.
    props.sort((a, b) => a.row - b.row);
    for (const prop of props) blitProp(ctx, prop.url, prop.col, prop.row, prop.size);
  });

  return {
    layers,
    width,
    height,
    signature: layerSignatures(interior),
    release: () => {
      for (const layer of layers) if (layer.url) URL.revokeObjectURL(layer.url);
    },
  };
}

/** Exported for tests — a field's art-relevant state, and nothing more. */
export const fieldSignature = (fields: readonly FieldTile[]) =>
  fields.map((f) => `${f.col},${f.row}:${f.status}:${stageOf(f) ?? '-'}`).join(';');
