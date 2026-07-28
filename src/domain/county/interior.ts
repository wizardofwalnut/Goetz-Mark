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

/** Compass edge a road leaves the county by. */
export type Exit = 'n' | 'e' | 's' | 'w';

export const EXITS: readonly Exit[] = ['n', 'e', 's', 'w'];

export interface CountyInterior {
  /** Every cell of the grid — the ground beneath everything else. */
  readonly ground: readonly GroundCell[];
  /** The bounded workable subset. Positions index into the ground grid. */
  readonly fields: readonly FieldTile[];
  /** Sprites standing ON ground cells — never tiles in their own right. */
  readonly industry: readonly IndustrySiteState[];
  /**
   * Cells the road runs through, town outward.
   *
   * Each road that leaves the county carries ONE CELL PAST the boundary. That
   * cell is out of the grid and never drawn; it exists so the renderer can
   * tell a road that crosses the county edge from one that merely stops at it,
   * which position alone cannot distinguish.
   */
  readonly road: readonly { readonly col: number; readonly row: number }[];
  /** Which county edges the road actually reaches. */
  readonly exits: readonly Exit[];
  /** Grid extent, so the renderer need not recompute it. */
  readonly cols: number;
  readonly rows: number;
  /** Where the county town sits on the grid. */
  readonly town: { readonly col: number; readonly row: number };
  /**
   * Where the castle stands.
   *
   * Held in the data rather than worked out by the renderer, and deliberately
   * NOT the town cell: the spec is explicit that the castle sits near the town
   * without fusing into one sprite blob with it. A renderer that picked the
   * spot itself would also have no way to stop a field being planted there.
   */
  readonly castle: { readonly col: number; readonly row: number };
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
  /**
   * The county's hard-mineral slot: stone OR ore, never both.
   *
   * Separate from `resource` because a wheat county can still sit on iron.
   * This is what decides whether a mine or a quarry exists here at all — the
   * exclusivity rule is enforced by there being one slot, not by the UI
   * refusing to draw the second site.
   */
  mineral?: 'stone' | 'ore' | null;
  /** Injected for determinism — interiors must generate identically per device. */
  rng: () => number;
  /**
   * Which county edges a road leaves by — one per neighbouring county.
   *
   * Passed in rather than derived here because only the realm map knows who
   * borders whom, and an interior that invented its own exits could point a
   * road at an edge with nothing on the other side.
   */
  exits?: readonly Exit[];
  /**
   * Grid extent override.
   *
   * The default sizes the grid from the county's `size`, which suited the
   * 19-county draft map. v2's four-county world wants a tighter interior: with
   * tiles drawn large enough to tap comfortably, a county the player has to
   * pan around in three directions costs more than the extra ground is worth.
   */
  grid?: { readonly cols: number; readonly rows: number };
}): CountyInterior {
  const { size, resource, rng, mineral = null, exits = [], grid } = opts;

  // Grid grows with county size but stays hand-readable on a phone. It is
  // deliberately larger than the field count — most of a county is ground the
  // player crosses rather than farms.
  const cols = grid?.cols ?? 7 + Math.min(4, size);
  const rows = grid?.rows ?? 7 + Math.min(4, size);
  const town = { col: Math.floor(cols / 2), row: Math.floor(rows / 2) };

  // --- roads -------------------------------------------------------------
  // Laid FIRST, so the ground layer knows to keep them clear. A road that
  // ends in a mountain is not a road.
  const road = buildRoads(town, { cols, rows }, exits);
  const onRoad = new Set(road.map((c) => cellKey(c.col, c.row)));

  // Far enough from the town to read as its own building, close enough to
  // still read as guarding it. Off the road, so the castle never buries the
  // one part of the county that movement rules hang off.
  // One column across and two rows back: diagonal from the town, so the two
  // sprites never touch, and never on the grid's outer column where half the
  // keep would sit off the edge of the view.
  const castle = {
    col: Math.min(cols - 2, Math.max(1, town.col - 1)),
    row: Math.min(rows - 2, Math.max(1, town.row - 2)),
  };

  // --- ground layer ------------------------------------------------------
  // Impassable terrain clusters at the edges, leaving the middle workable —
  // scattering mountains through the centre would strand fields at random.
  const ground: GroundCell[] = [];
  const centre = { col: (cols - 1) / 2, row: (rows - 1) / 2 };

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if ((col === town.col && row === town.row) || (col === castle.col && row === castle.row)) {
        // The settlement stands on open ground. Rolling a mountain under the
        // castle would put a building on a tile nothing can cross.
        ground.push({ col, row, kind: 'ground' });
        continue;
      }
      // How close to the RIM, measured per axis rather than as a radius.
      //
      // A radial distance normalised by the corner distance only reads as
      // "edge" along whichever axis is longer: on a 7x17 county it put crags
      // in thick bands across the top and bottom while the left and right
      // columns never qualified at all. Taking the worst axis separately
      // hugs the actual boundary whatever shape the county is.
      const edgeness = Math.max(
        Math.abs(col - centre.col) / Math.max(1, centre.col),
        Math.abs(row - centre.row) / Math.max(1, centre.row),
      );
      const roll = rng();
      let kind: GroundKind = 'ground';
      // Only the outer band gets terrain, and even there most stays walkable.
      // A ONE-CELL rim, not a wide frontier. At 0.62 a tall county came out as
      // a corridor of farmland hemmed in by wilderness on every side: the
      // threshold is a fraction of the half-width, so a low one claims most of
      // a grid that is much longer than it is wide.
      if (!onRoad.has(cellKey(col, row)) && edgeness > 0.78 && roll < 0.4) {
        const pick = rng();
        kind = pick < 0.5 ? 'forest' : pick < 0.85 ? 'mountain' : 'water';
      }
      ground.push({ col, row, kind });
    }
  }

  // Fields and industry never sit on the road. The road is how armies, wagons
  // and supplies cross the county; building over it would make the one piece
  // of the county with movement rules attached to it disappear under a crop.
  const passable = ground.filter(
    (g) =>
      isPassable(g.kind) &&
      !(g.col === town.col && g.row === town.row) &&
      !(g.col === castle.col && g.row === castle.row) &&
      !onRoad.has(cellKey(g.col, g.row)),
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
  // The hard-mineral site, if the county has that slot filled. One or the
  // other, never both — a county cannot grow a quarry next to its mine.
  if (mineral) place(INDUSTRY_FOR_RESOURCE[mineral], null);
  // Every county can forge, but only once it is staffed.
  place('blacksmith', 'swords');

  return { ground, fields, industry, road, exits, cols, rows, town, castle };
}

/**
 * Lay the county's roads: town centre out to each edge that has a neighbour.
 *
 * An L-path (along the row, then along the column) rather than anything
 * cleverer. Roads are a movement discount and a landmark, not a puzzle, and a
 * straight-then-turn run reads instantly at a glance.
 *
 * Every road runs ONE CELL PAST the county boundary. That cell is outside the
 * grid and never drawn — it is there so the renderer can tell a road that
 * leaves the county from one that stops at its edge.
 */
function buildRoads(
  town: { readonly col: number; readonly row: number },
  bounds: { readonly cols: number; readonly rows: number },
  exits: readonly Exit[],
): { readonly col: number; readonly row: number }[] {
  const seen = new Set<string>();
  const out: { col: number; row: number }[] = [];
  const push = (col: number, row: number) => {
    const k = cellKey(col, row);
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ col, row });
  };

  push(town.col, town.row);

  for (const exit of exits) {
    const target =
      exit === 'n'
        ? { col: town.col, row: -1 }
        : exit === 's'
          ? { col: town.col, row: bounds.rows }
          : exit === 'w'
            ? { col: -1, row: town.row }
            : { col: bounds.cols, row: town.row };

    const stepCol = Math.sign(target.col - town.col);
    for (let c = town.col; c !== target.col; c += stepCol) push(c, town.row);
    const stepRow = Math.sign(target.row - town.row);
    for (let r = town.row; r !== target.row; r += stepRow) push(target.col, r);
    push(target.col, target.row);
  }

  return out;
}
