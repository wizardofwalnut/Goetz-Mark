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

export interface CountyInterior {
  readonly fields: readonly FieldTile[];
  readonly industry: readonly IndustrySiteState[];
  /** Grid extent, so the renderer need not recompute it. */
  readonly cols: number;
  readonly rows: number;
  /** Where the county town sits on the grid. */
  readonly town: { readonly col: number; readonly row: number };
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

  // Grid grows with county size but stays hand-readable on a phone.
  const cols = 4 + Math.min(3, Math.floor(size / 2));
  const rows = 4 + Math.min(3, Math.floor(size / 2));
  const town = { col: Math.floor(cols / 2), row: Math.floor(rows / 2) };

  const fields: FieldTile[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (col === town.col && row === town.row) continue;

      // A minority of tiles start barren so reclamation has a reason to exist
      // from turn one rather than being a mechanic nobody meets.
      const roll = rng();
      const status: FieldStatus = roll < 0.15 ? 'barren' : 'fallow';

      fields.push({
        id: `f_${col}_${row}`,
        col,
        row,
        status,
        seasonsGrown: 0,
        herd: 0,
        reclaimed: 0,
      });
    }
  }

  const industry: IndustrySiteState[] = [];
  if (resource !== 'wheat' && resource !== 'cows') {
    const kind = INDUSTRY_FOR_RESOURCE[resource];
    // Placed off-centre so it does not fight the town for attention.
    industry.push({
      kind,
      col: Math.max(0, town.col - 2),
      row: Math.max(0, town.row - 1),
      active: false,
      workers: 0,
      weapon: null,
    });
  }

  // Every county can forge, but only once it is staffed.
  industry.push({
    kind: 'blacksmith',
    col: Math.min(cols - 1, town.col + 1),
    row: Math.min(rows - 1, town.row + 1),
    active: false,
    workers: 0,
    weapon: 'swords',
  });

  return { fields, industry, cols, rows, town };
}
