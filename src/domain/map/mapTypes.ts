import type { CountyId, MapId } from '../ids';
import type { Resource } from '../resources';

/**
 * Static map definition — the immutable "board".
 *
 * A GameMap never changes during a match. Everything that DOES change during a
 * match (who owns what, garrisons, stores) lives in MatchState, keyed by
 * CountyId. Keeping the board and the match state separate is what lets a
 * saved match be a small diff rather than a copy of the whole map, which
 * matters once this syncs through Firebase.
 */

export type Terrain = 'open' | 'forest' | 'hills' | 'chokepoint';

/** Movement cost to *enter* a county of this terrain, before road discounts. */
export const TERRAIN_MOVE_COST: Record<Terrain, number> = {
  open: 2,
  forest: 3,
  hills: 3,
  chokepoint: 4,
};

/** Defender output multiplier granted by the terrain being fought over. */
export const TERRAIN_DEFENCE_MODIFIER: Record<Terrain, number> = {
  open: 1.0,
  forest: 1.15,
  hills: 1.25,
  chokepoint: 1.4,
};

/** A road link discounts movement to this flat cost regardless of terrain. */
export const ROAD_MOVE_COST = 1;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface CountyDef {
  readonly id: CountyId;
  readonly name: string;
  /**
   * Build slots / population cap. Deliberately asymmetric across the map —
   * uniform county sizes remove most of the reason to prefer one direction
   * of expansion over another.
   */
  readonly size: number;
  readonly terrain: Terrain;
  readonly resource: Resource;
  /** Units of `resource` produced per turn at full labour allocation. */
  readonly yield: number;
  /** Polygon in map coordinate space. Shared borders share vertices exactly. */
  readonly shape: readonly Point[];
  /** Where the castle marker and county label are drawn. */
  readonly centroid: Point;
  /** Which basin this county sits in — used by map analysis and AI. */
  readonly region: string;
}

export interface BorderDef {
  readonly a: CountyId;
  readonly b: CountyId;
  /** A road link between these two counties, discounting movement cost. */
  readonly road: boolean;
}

export interface StartingPosition {
  /** Seat index 0..3. A map supports players up to `starts.length`. */
  readonly seat: number;
  readonly county: CountyId;
}

export interface GameMap {
  readonly id: MapId;
  readonly name: string;
  readonly description: string;
  /** Coordinate space the polygons are authored in. */
  readonly width: number;
  readonly height: number;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly counties: readonly CountyDef[];
  readonly borders: readonly BorderDef[];
  readonly starts: readonly StartingPosition[];
  /**
   * Non-playable decoration (mountain ridges flanking the pass). Rendered, but
   * has no gameplay state — impassability is expressed by the absence of a
   * border, never by geometry.
   */
  readonly scenery?: readonly { readonly kind: string; readonly shape: readonly Point[] }[];
}
