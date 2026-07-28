import type { MaterialResource } from '../resources';
import { GRAIN_STAGE_YIELD, grainStage, type GrainStage } from '../season';

/**
 * County interior — what the county screen renders and edits.
 *
 * This is a SECOND map level. The realm map treats a county as one region; this
 * models what is inside one: individual field tiles the player plants, industry
 * sites they staff, and the town at the centre. The two levels stay separate
 * because they change on completely different cadences — the realm map is
 * static board data, a county interior mutates every season.
 *
 * Interiors are generated from the county's static definition rather than
 * hand-authored, so a map pack ships county stats and gets a playable interior
 * for free.
 */

export type FieldStatus =
  | 'fallow' // ploughed, nothing planted — ready to use
  | 'barren' // worked out; needs reclaiming before it will grow anything
  | 'grain'
  | 'cattle'
  | 'parched' // storm damage. Becomes barren after one season.
  | 'flooded';

export const STORM_DAMAGED: readonly FieldStatus[] = ['parched', 'flooded'];

export type IndustryKind = 'quarry' | 'mine' | 'lumberMill' | 'blacksmith';

/** Weapons a blacksmith can be set to produce. */
export const WEAPONS = ['swords', 'bows', 'crossbows', 'maces', 'pikes'] as const;
export type Weapon = (typeof WEAPONS)[number];

export interface FieldTile {
  readonly id: string;
  /** Position on the county's isometric grid. */
  readonly col: number;
  readonly row: number;
  readonly status: FieldStatus;
  /** Seasons a grain crop has been in the ground. Only meaningful for grain. */
  readonly seasonsGrown: number;
  /**
   * Cattle in this field, 0-3. Three is overcrowded — the visual cue to open
   * another field rather than a number the player has to look up.
   */
  readonly herd: number;
  /** Reclamation of a barren field, 0..1. Capped per season, so it takes time. */
  readonly reclaimed: number;
}

export interface IndustrySiteState {
  readonly kind: IndustryKind;
  readonly col: number;
  readonly row: number;
  /** Inactive sites sit on the map but produce nothing and draw no labour. */
  readonly active: boolean;
  readonly workers: number;
  /** Blacksmiths only. What is currently on the anvil. */
  readonly weapon: Weapon | null;
}

/** Maximum a barren field can be reclaimed in one season. */
export const RECLAIM_PER_SEASON = 0.25;

export const MAX_HERD_PER_FIELD = 3;

/**
 * The ground layer.
 *
 * TWO LAYERS, and conflating them is a real bug rather than a shortcut:
 *
 *   - The TILE layer is the ground itself. Most of a county is plain walkable
 *     ground with nothing to assign — it is a surface armies cross, not
 *     something the player manages. Forest, mountain and water are impassable
 *     decoration on the same layer.
 *   - FIELDS are a bounded, countable subset (8-16 per county) and are the ONLY
 *     tiles carrying the fallow/grain/cattle interaction. They must read as
 *     visibly workable even when fallow, so a player can see at a glance which
 *     ground is theirs to plant.
 *
 * Treating every tile as a field — which an earlier pass did — makes the whole
 * county one undifferentiated management surface and destroys that glance.
 */
export type GroundKind = 'ground' | 'forest' | 'mountain' | 'water';

/** Only plain ground can be walked, built on, or turned into a field. */
export const PASSABLE: readonly GroundKind[] = ['ground'];
export const isPassable = (kind: GroundKind) => PASSABLE.includes(kind);

export interface GroundCell {
  readonly col: number;
  readonly row: number;
  readonly kind: GroundKind;
}

/** Field count per county, by size. The spec's bounded 8-16 range. */
export const MIN_FIELDS = 8;
export const MAX_FIELDS = 16;

export interface CountyInterior {
  /** Every cell of the grid — the ground beneath everything else. */
  readonly ground: readonly GroundCell[];
  /** The bounded workable subset. Positions index into the ground grid. */
  readonly fields: readonly FieldTile[];
  /** Sprites standing ON ground cells — never tiles in their own right. */
  readonly industry: readonly IndustrySiteState[];
  /** Grid extent, so the renderer need not recompute it. */
  readonly cols: number;
  readonly rows: number;
  /** Where the county town sits on the grid. */
  readonly town: { readonly col: number; readonly row: number };
}

const cellKey = (col: number, row: number) => `${col},${row}`;

/** Look up what kind of ground is under a position. */
export function groundAt(interior: CountyInterior, col: number, row: number): GroundKind {
  return interior.ground.find((g) => g.col === col && g.row === row)?.kind ?? 'ground';
}

/** Which industry a resource supports, or null if it is farmed rather than worked. */
export const INDUSTRY_FOR_RESOURCE: Record<MaterialResource, IndustryKind> = {
  stone: 'quarry',
  ore: 'mine',
  wood: 'lumberMill',
  gold: 'mine',
};

export const isFarmable = (f: FieldTile) =>
  f.status === 'fallow' || f.status === 'grain' || f.status === 'cattle';

export const isStormDamaged = (f: FieldTile) => STORM_DAMAGED.includes(f.status);

/** Yield share this field currently offers, accounting for crop maturity. */
export function fieldYieldShare(field: FieldTile): number {
  switch (field.status) {
    case 'grain':
      return GRAIN_STAGE_YIELD[grainStage(field.seasonsGrown)];
    case 'cattle':
      // Overcrowding suppresses growth rather than stopping it outright.
      return field.herd === 0 ? 0 : field.herd >= MAX_HERD_PER_FIELD ? 0.7 : 1;
    default:
      return 0;
  }
}

export const stageOf = (field: FieldTile): GrainStage | null =>
  field.status === 'grain' ? grainStage(field.seasonsGrown) : null;

/**
 * Which statuses a field can legally be switched to.
 *
 * Barren land cannot simply be replanted — it has to be reclaimed first, which
 * is why reclamation is a labour task rather than a button that just works.
 * Storm-damaged fields are locked until they settle to barren.
 */
export function allowedTransitions(field: FieldTile): FieldStatus[] {
  if (isStormDamaged(field)) return [];
  if (field.status === 'barren') return field.reclaimed >= 1 ? ['fallow'] : [];
  return (['fallow', 'grain', 'cattle'] as FieldStatus[]).filter((s) => s !== field.status);
}

/**
 * Whether switching this field destroys a crop in the ground.
 *
 * The UI must confirm before an action that answers true. This is the "don't
 * accidentally destroy your crop" rail the original leans on, and it is the
 * reason the tap convention matters — a stray tap must never cost a harvest.
 */
export const destroysCrop = (field: FieldTile) =>
  field.status === 'grain' && grainStage(field.seasonsGrown) !== 'spoiled';

/**
 * Build a county's interior from its size.
 *
 * Bigger counties get more field tiles, which is what `size` on a CountyDef has
 * always meant — this is where that number finally does something.
 */
export function createInterior(opts: {
  size: number;
  resource: MaterialResource | 'wheat' | 'cows';
  /** Injected for determinism — interiors must generate identically per device. */
  rng: () => number;
}): CountyInterior {
  const { size, resource, rng } = opts;

  // Grid grows with county size but stays hand-readable on a phone. It is
  // deliberately larger than the field count — most of a county is ground the
  // player crosses rather than farms.
  const cols = 7 + Math.min(4, size);
  const rows = 7 + Math.min(4, size);
  const town = { col: Math.floor(cols / 2), row: Math.floor(rows / 2) };

  // --- ground layer ------------------------------------------------------
  // Impassable terrain clusters at the edges, leaving the middle workable —
  // scattering mountains through the centre would strand fields at random.
  const ground: GroundCell[] = [];
  const centre = { col: (cols - 1) / 2, row: (rows - 1) / 2 };
  const maxDist = Math.hypot(centre.col, centre.row);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (col === town.col && row === town.row) {
        ground.push({ col, row, kind: 'ground' });
        continue;
      }
      const edgeness = Math.hypot(col - centre.col, row - centre.row) / maxDist;
      const roll = rng();
      let kind: GroundKind = 'ground';
      // Only the outer band gets terrain, and even there most stays walkable.
      if (edgeness > 0.62 && roll < 0.45) {
        const pick = rng();
        kind = pick < 0.5 ? 'forest' : pick < 0.85 ? 'mountain' : 'water';
      }
      ground.push({ col, row, kind });
    }
  }

  const passable = ground.filter(
    (g) => isPassable(g.kind) && !(g.col === town.col && g.row === town.row),
  );

  // --- fields ------------------------------------------------------------
  // A bounded set, not the whole grid. Placed nearest the town first, so a
  // county's workable land reads as belonging to it rather than scattered.
  const target = Math.min(
    MAX_FIELDS,
    Math.max(MIN_FIELDS, MIN_FIELDS + size * 2),
    passable.length,
  );
  const byDistance = [...passable].sort(
    (a, b) =>
      Math.hypot(a.col - town.col, a.row - town.row) -
      Math.hypot(b.col - town.col, b.row - town.row),
  );

  const fields: FieldTile[] = byDistance.slice(0, target).map((cell) => ({
    id: `f_${cell.col}_${cell.row}`,
    col: cell.col,
    row: cell.row,
    // A minority start barren so reclamation is met from turn one rather than
    // being a mechanic nobody encounters.
    status: (rng() < 0.15 ? 'barren' : 'fallow') as FieldStatus,
    seasonsGrown: 0,
    herd: 0,
    reclaimed: 0,
  }));

  // --- industry sprites --------------------------------------------------
  // Sprites stand ON ground cells; they are never tiles themselves. Placed
  // outside the field block so they do not sit on workable land.
  const taken = new Set(fields.map((f) => cellKey(f.col, f.row)));
  const freeGround = byDistance
    .slice(target)
    .filter((c) => !taken.has(cellKey(c.col, c.row)));

  const industry: IndustrySiteState[] = [];
  const place = (kind: IndustrySiteState['kind'], weapon: IndustrySiteState['weapon']) => {
    const cell = freeGround.shift() ?? byDistance[byDistance.length - 1];
    if (!cell) return;
    taken.add(cellKey(cell.col, cell.row));
    industry.push({ kind, col: cell.col, row: cell.row, active: false, workers: 0, weapon });
  };

  if (resource !== 'wheat' && resource !== 'cows') {
    place(INDUSTRY_FOR_RESOURCE[resource], null);
  }
  // Every county can forge, but only once it is staffed.
  place('blacksmith', 'swords');

  return { ground, fields, industry, cols, rows, town };
}
