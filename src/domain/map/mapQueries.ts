import type { CountyId } from '../ids';
import type { CountyDef, GameMap } from './mapTypes';
import { ROAD_MOVE_COST, TERRAIN_MOVE_COST } from './mapTypes';

/**
 * Read-only queries over a static map.
 *
 * These take the map as an argument rather than closing over one so that map
 * packs (a paid content drop) work without touching this file.
 */

export interface MapIndex {
  readonly map: GameMap;
  readonly countyById: ReadonlyMap<CountyId, CountyDef>;
  readonly neighbours: ReadonlyMap<CountyId, readonly CountyId[]>;
  readonly roads: ReadonlySet<string>;
}

const borderKey = (a: CountyId, b: CountyId) => ([a, b] as string[]).sort().join('|');

export function indexMap(map: GameMap): MapIndex {
  const countyById = new Map(map.counties.map((c) => [c.id, c]));
  const neighbours = new Map<CountyId, CountyId[]>(map.counties.map((c) => [c.id, []]));
  const roads = new Set<string>();

  for (const b of map.borders) {
    neighbours.get(b.a)?.push(b.b);
    neighbours.get(b.b)?.push(b.a);
    if (b.road) roads.add(borderKey(b.a, b.b));
  }

  return { map, countyById, neighbours, roads };
}

export const neighboursOf = (ix: MapIndex, c: CountyId): readonly CountyId[] =>
  ix.neighbours.get(c) ?? [];

export const areAdjacent = (ix: MapIndex, a: CountyId, b: CountyId): boolean =>
  neighboursOf(ix, a).includes(b);

export const hasRoad = (ix: MapIndex, a: CountyId, b: CountyId): boolean =>
  ix.roads.has(borderKey(a, b));

export function requireCounty(ix: MapIndex, c: CountyId): CountyDef {
  const def = ix.countyById.get(c);
  if (!def) throw new Error(`Unknown county: ${c}`);
  return def;
}

/**
 * Movement cost to travel from `from` into `to`.
 *
 * Roads beat open field, open field beats rough ground — the cost is a property
 * of the terrain being entered, discounted flat if a road links the two.
 */
export function moveCost(ix: MapIndex, from: CountyId, to: CountyId): number {
  if (!areAdjacent(ix, from, to)) return Infinity;
  if (hasRoad(ix, from, to)) return ROAD_MOVE_COST;
  return TERRAIN_MOVE_COST[requireCounty(ix, to).terrain];
}

/** Counties reachable within a movement budget, with the cost to reach each. */
export function reachableFrom(
  ix: MapIndex,
  origin: CountyId,
  budget: number,
): ReadonlyMap<CountyId, number> {
  const best = new Map<CountyId, number>([[origin, 0]]);
  // Small graphs (tens of counties), so a simple relaxation loop beats the
  // overhead of a real priority queue and is easier to read.
  const queue: CountyId[] = [origin];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const spent = best.get(current)!;
    for (const next of neighboursOf(ix, current)) {
      const total = spent + moveCost(ix, current, next);
      if (total > budget) continue;
      const known = best.get(next);
      if (known === undefined || total < known) {
        best.set(next, total);
        queue.push(next);
      }
    }
  }
  return best;
}

/** Connected components of a set of counties, using map adjacency. */
export function connectedComponents(
  ix: MapIndex,
  owned: Iterable<CountyId>,
): CountyId[][] {
  const remaining = new Set(owned);
  const components: CountyId[][] = [];

  while (remaining.size > 0) {
    const seed = remaining.values().next().value as CountyId;
    remaining.delete(seed);
    const component = [seed];
    const stack = [seed];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const next of neighboursOf(ix, current)) {
        if (!remaining.has(next)) continue;
        remaining.delete(next);
        component.push(next);
        stack.push(next);
      }
    }
    components.push(component);
  }
  return components;
}

/**
 * Counties cut off from a player's capital after losing territory.
 *
 * The design doc keeps the original's severed-territory rule: hold a connected
 * chain and lose the middle, and the far end may fall away on its own. This
 * returns the counties in components that no longer reach `capital`.
 */
export function severedFrom(
  ix: MapIndex,
  owned: Iterable<CountyId>,
  capital: CountyId,
): CountyId[] {
  const components = connectedComponents(ix, owned);
  return components
    .filter((component) => !component.includes(capital))
    .flat();
}

/**
 * Counties whose removal disconnects the map — articulation points.
 *
 * Used to verify a map has the chokepoints its design claims, and by the AI to
 * value a county positionally rather than only by its resource yield.
 */
export function chokepoints(ix: MapIndex): CountyId[] {
  const all = [...ix.countyById.keys()];
  if (all.length === 0) return [];
  const baseline = connectedComponents(ix, all).length;

  return all.filter((candidate) => {
    const rest = all.filter((c) => c !== candidate);
    if (rest.length === 0) return false;
    return connectedComponents(ix, rest).length > baseline;
  });
}
