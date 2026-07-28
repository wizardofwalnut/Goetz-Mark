import manifestJson from './manifest.json';
import type { FactionId } from '../domain/ids';
import type { CastleTier, UnitKind } from '../domain/match/matchState';
import type { Terrain } from '../domain/map/mapTypes';
import type { Resource } from '../domain/resources';
import type { Season, GrainStage } from '../domain/season';
import type { FieldStatus, GroundKind, IndustryKind } from '../domain/county/interior';

/**
 * Asset manifest.
 *
 * THE RULE: game logic and UI components never name an image file. They ask for
 * a logical thing ("the knights sprite for the Warden") and the manifest maps
 * that to a path.
 *
 * Two things in the design depend on this being true:
 *
 *   1. Map packs and cosmetic banners/crests are meant to ship as content
 *      drops. If a component points at `militia.png`, adding a banner becomes a
 *      code change and a redeploy instead of a data update.
 *   2. The art surface is small and will be regenerated often while the visual
 *      direction settles. Swapping one manifest line beats hunting call sites.
 *
 * Faction-specific art is OPTIONAL. `unit.knights.warden` falls back to
 * `unit.knights`, which falls back to a styled placeholder. That means art can
 * land incrementally — a faction without custom sprites renders the generic
 * ones rather than a broken image.
 */

export interface AssetEntry {
  readonly path: string;
  /**
   * Declared but not yet generated.
   *
   * The manifest doubles as the art pipeline's work list, so an entry exists
   * before PixelLab has produced the file. A pending entry must NOT resolve to
   * a url — pointing an <image> at a path that 404s renders the browser's
   * broken-image glyph, which is worse than the designed fallback.
   */
  readonly pending?: boolean;
  /** Seamlessly tileable — safe to use as a repeating pattern fill. */
  readonly tile?: boolean;
  /** Nine-slice insets [top, right, bottom, left] for stretchable UI chrome. */
  readonly nineSlice?: readonly number[];
  /**
   * A kit sheet holding many components in one image, not a single usable
   * asset. PixelLab's UI generator returns these — a whole set of panels,
   * buttons and bars together. A sheet must be sliced before anything can
   * render it, so it is never handed straight to a component.
   */
  readonly sheet?: boolean;
  /** For a sliced entry, the kit sheet it is cut from. */
  readonly from?: string;
}

export interface AssetManifest {
  readonly schemaVersion: number;
  readonly basePath: string;
  readonly generator: string;
  readonly style: { readonly paletteRef: string; readonly note: string };
  readonly entries: Readonly<Record<string, AssetEntry>>;
}

export const MANIFEST = manifestJson as AssetManifest;

export interface ResolvedAsset {
  readonly key: string;
  readonly url: string | null;
  readonly entry: AssetEntry | null;
  /**
   * No usable art — either nothing is declared, or what is declared is still
   * pending generation. Callers draw their fallback when this is true, and
   * must never build a url of their own.
   */
  readonly missing: boolean;
  /**
   * A manifest entry exists for this thing, even if the art is not ready.
   * Distinguishes "art is queued" from "nobody has thought about this yet",
   * which is what the coverage tests check.
   */
  readonly declared: boolean;
  readonly tile: boolean;
  readonly nineSlice: readonly number[] | null;
}

const joinPath = (base: string, path: string) =>
  `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

/**
 * Resolve the first key with usable art, in preference order.
 *
 * Returning a `missing: true` result rather than throwing is deliberate: art
 * arrives incrementally, and an ungenerated sprite should degrade to a styled
 * placeholder, not take down the map.
 *
 * Pending entries are skipped rather than returned, so a faction whose custom
 * sprite is queued still falls through to the generic one if THAT is ready.
 */
export function resolveAsset(
  keys: readonly string[],
  manifest: AssetManifest = MANIFEST,
): ResolvedAsset {
  let declared = false;

  for (const key of keys) {
    const entry = manifest.entries[key];
    if (!entry) continue;
    declared = true;
    if (entry.pending) continue;

    return {
      key,
      url: joinPath(manifest.basePath, entry.path),
      entry,
      missing: false,
      declared: true,
      tile: entry.tile ?? false,
      nineSlice: entry.nineSlice ?? null,
    };
  }

  return {
    key: keys[keys.length - 1] ?? 'unknown',
    url: null,
    entry: null,
    missing: true,
    declared,
    tile: false,
    nineSlice: null,
  };
}

// ---------------------------------------------------------------------------
// Typed accessors.
//
// These exist so a typo is a compile error rather than a silently missing
// sprite, and so the key format stays in one place. Callers use these, never
// raw strings.
// ---------------------------------------------------------------------------

/**
 * Terrain tile, optionally for a season.
 *
 * Falls back to the season-less tile, so the map keeps rendering while the
 * seasonal sets are generated one at a time rather than all-or-nothing.
 */
export const terrainArt = (terrain: Terrain, season?: Season) =>
  resolveAsset(season ? [`terrain.${terrain}.${season}`, `terrain.${terrain}`] : [`terrain.${terrain}`]);

/**
 * Ground tile — the layer beneath everything.
 *
 * Distinct from `fieldArt`: most of a county is plain walkable ground with no
 * crop or furrow detail, and drawing field art under the whole grid is what
 * made an earlier pass read as one undifferentiated farm.
 */
export const groundArt = (kind: GroundKind, season?: Season) =>
  resolveAsset(season ? [`tile.${kind}.${season}`, `tile.${kind}`] : [`tile.${kind}`]);

/** Field tile art. Grain resolves by growth stage. */
export const fieldArt = (status: FieldStatus, stage?: GrainStage | null) =>
  resolveAsset(
    status === 'grain' && stage
      ? [`field.grain.${stage}`, 'field.fallow']
      : [`field.${status}`, 'field.fallow'],
  );

/** Industry site, working or idle. */
export const industryArt = (kind: IndustryKind, working: boolean) =>
  resolveAsset([`industry.${kind}.${working ? 'working' : 'idle'}`, `industry.${kind}.idle`]);

/**
 * Army figure count scales with size, per the county-screen spec: 1/2/3 figures
 * read as small/medium/large without the player reading a number.
 */
export const armySizeBand = (troops: number): 'small' | 'medium' | 'large' =>
  troops < 30 ? 'small' : troops < 80 ? 'medium' : 'large';

export const armyArt = (troops: number) => resolveAsset([`sprite.army.${armySizeBand(troops)}`]);

/** Loose sprites named by the spec — cow, wagons, mercenary offer. */
export const spriteArt = (name: string) => resolveAsset([`sprite.${name}`]);

/**
 * Castle art for a tier. `none` deliberately has no entry — a county without a
 * castle draws nothing, so asking for its art is a caller bug rather than
 * missing art, and the resolver says so via `declared: false`.
 */
export const castleArt = (tier: CastleTier) => resolveAsset([`castle.${tier}`]);

/** Faction art wins if present; otherwise the generic unit sprite. */
export const unitArt = (kind: UnitKind, faction?: FactionId) =>
  resolveAsset(faction ? [`unit.${kind}.${faction}`, `unit.${kind}`] : [`unit.${kind}`]);

export const resourceArt = (resource: Resource) => resolveAsset([`resource.${resource}`]);

export const crestArt = (faction: FactionId) => resolveAsset([`crest.${faction}`]);

/** Banners are cosmetics — addressed by id so new ones ship as data. */
export const bannerArt = (bannerId: string) => resolveAsset([`banner.${bannerId}`]);

export const uiArt = (name: string) => resolveAsset([`ui.${name}`]);

/**
 * Which manifest keys have no art yet.
 *
 * Used by the dev overlay and by the manifest test, so "the manifest lists a
 * file that was never generated" is visible rather than discovered on a phone.
 */
export function manifestKeys(manifest: AssetManifest = MANIFEST): string[] {
  return Object.keys(manifest.entries);
}

/** Declared keys still awaiting generation — the art pipeline's work list. */
export function pendingKeys(manifest: AssetManifest = MANIFEST): string[] {
  return Object.entries(manifest.entries)
    .filter(([, e]) => e.pending)
    .map(([k]) => k);
}
