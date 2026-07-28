import type { CountyInterior, GroundKind } from './interior';
import { isPassable } from './interior';

/**
 * Movement inside a county.
 *
 * The realm map already prices movement BETWEEN counties (TERRAIN_MOVE_COST and
 * ROAD_MOVE_COST in map/mapTypes.ts). This is the second map level: what can
 * cross a given cell of a county interior, and what it costs.
 *
 * Two rules from the spec live here rather than in the renderer, because they
 * are rules about the world and not about how it is drawn:
 *
 *   - A merchant wagon travels ONLY on roads. Never across open land, not even
 *     slowly. That is a hard constraint, which is why it is a separate travel
 *     kind rather than a large number.
 *   - Everything on foot may cross open ground, but a road is meaningfully
 *     faster. The spec asks for that to be "a felt difference, not just a
 *     hidden movement-point number", so the gap is deliberately wide.
 *
 * Nothing crosses forest, mountain or water — impassability is a property of
 * the ground, and is the same for every traveller.
 */

/**
 * How a thing gets about.
 *
 * Not "which unit is it": a supply wagon and a merchant caravan are different
 * things on the map with the same travel rules, and splitting the kind from the
 * unit is what stops that being duplicated.
 */
export type TravelKind = 'wheeled' | 'foot';

/** Movement points to enter a cell of plain open ground. */
export const OFF_ROAD_COST = 3;

/** Movement points to enter a road cell, whatever the ground beneath it. */
export const ON_ROAD_COST = 1;

/** Cell reference, matching the interior's own coordinates. */
export interface At {
  readonly col: number;
  readonly row: number;
}

const key = (col: number, row: number) => `${col},${row}`;

/** Road cells of an interior, as a set. The sentinel outside the grid is included. */
export function roadCells(interior: CountyInterior): ReadonlySet<string> {
  return new Set(interior.road.map((c) => key(c.col, c.row)));
}

export const isRoad = (interior: CountyInterior, at: At): boolean =>
  roadCells(interior).has(key(at.col, at.row));

/** The ground under a cell. Anything off the grid is treated as impassable. */
function groundKindAt(interior: CountyInterior, at: At): GroundKind | null {
  if (at.col < 0 || at.row < 0 || at.col >= interior.cols || at.row >= interior.rows) {
    return null;
  }
  return interior.ground.find((g) => g.col === at.col && g.row === at.row)?.kind ?? 'ground';
}

/**
 * Whether a traveller may enter this cell at all.
 *
 * Wheeled traffic answers false for every cell without a road, which is the
 * whole of the merchant constraint. Note this is about the CELL — a wagon that
 * has nowhere to go is a wagon that stays where it is, not one that crawls.
 */
export function canEnter(kind: TravelKind, interior: CountyInterior, at: At): boolean {
  const ground = groundKindAt(interior, at);
  if (ground === null) return false;

  const onRoad = isRoad(interior, at);
  // A road is a made surface: it crosses ground that would otherwise stop you.
  // Without this a road laid through a wood would be impassable along its
  // length, which is the opposite of what a road is for.
  if (onRoad) return true;
  if (kind === 'wheeled') return false;
  return isPassable(ground);
}

/**
 * Movement points to enter a cell, or null if the traveller cannot.
 *
 * Returning null rather than Infinity is deliberate: "cannot go there" and
 * "expensive" are different answers, and a caller that treats them the same
 * will eventually let a wagon off the road when it has points to spare.
 */
export function enterCost(kind: TravelKind, interior: CountyInterior, at: At): number | null {
  if (!canEnter(kind, interior, at)) return null;
  return isRoad(interior, at) ? ON_ROAD_COST : OFF_ROAD_COST;
}

/** Cells a traveller could step to from here, in the four cardinal directions. */
export function stepsFrom(
  kind: TravelKind,
  interior: CountyInterior,
  from: At,
): readonly At[] {
  const around: At[] = [
    { col: from.col, row: from.row - 1 },
    { col: from.col + 1, row: from.row },
    { col: from.col, row: from.row + 1 },
    { col: from.col - 1, row: from.row },
  ];
  return around.filter((at) => canEnter(kind, interior, at));
}
