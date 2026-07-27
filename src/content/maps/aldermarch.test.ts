import { describe, expect, it } from 'vitest';
import { ALDERMARCH } from './aldermarch.generated';
import { chokepoints, connectedComponents, indexMap, moveCost, reachableFrom } from '../../domain/map/mapQueries';
import { countyId } from '../../domain/ids';

/**
 * These tests assert the map's DESIGN CLAIMS, not its implementation.
 *
 * The design says: one deliberate chokepoint dividing the map, scarce stone
 * creating dependency, balanced starts. Each of those is a balance property
 * that would otherwise quietly rot the next time the layout is edited — a
 * chokepoint stops being a chokepoint the moment someone adds one border.
 */

const ix = indexMap(ALDERMARCH);
const all = ALDERMARCH.counties.map((c) => c.id);

describe('Aldermarch — structure', () => {
  it('is fully connected', () => {
    expect(connectedComponents(ix, all)).toHaveLength(1);
  });

  it('has no border referencing an unknown county', () => {
    for (const b of ALDERMARCH.borders) {
      expect(ix.countyById.has(b.a)).toBe(true);
      expect(ix.countyById.has(b.b)).toBe(true);
    }
  });

  it('has symmetric adjacency', () => {
    for (const c of all) {
      for (const n of ix.neighbours.get(c) ?? []) {
        expect(ix.neighbours.get(n)).toContain(c);
      }
    }
  });

  it('has no duplicate borders', () => {
    const keys = ALDERMARCH.borders.map((b) => [b.a, b.b].sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('Aldermarch — the single chokepoint', () => {
  it('has exactly one chokepoint, and it is Ironthroat', () => {
    expect(chokepoints(ix)).toEqual([countyId('ironthroat')]);
  });

  it('severs the map into two equal basins when Ironthroat is removed', () => {
    const without = all.filter((c) => c !== countyId('ironthroat'));
    const parts = connectedComponents(ix, without);
    expect(parts).toHaveLength(2);
    expect(parts.map((p) => p.length)).toEqual([9, 9]);
  });

  it('routes every north-south path through Ironthroat', () => {
    // Drop the pass from the graph; the two basins must land in different
    // components, with no county leaking across.
    const withoutPass = all.filter((c) => c !== countyId('ironthroat'));
    const regionOf = (c: (typeof all)[number]) => ix.countyById.get(c)!.region;

    for (const component of connectedComponents(ix, withoutPass)) {
      const regions = new Set(component.map(regionOf));
      expect(regions.size).toBe(1);
    }
  });
});

describe('Aldermarch — resource scarcity', () => {
  const byResource = (r: string) => ALDERMARCH.counties.filter((c) => c.resource === r);

  it('makes stone genuinely scarce', () => {
    const stone = byResource('stone');
    expect(stone).toHaveLength(3);
    // Scarcity only creates dependency if it is a small share of the map.
    expect(stone.length / ALDERMARCH.counties.length).toBeLessThan(0.2);
  });

  it('places no stone in any starting county', () => {
    // A start that self-supplies the scarce resource has no reason to trade or
    // expand for it, which is the entire point of the scarcity.
    const starts = new Set(ALDERMARCH.starts.map((s) => s.county));
    for (const c of byResource('stone')) {
      expect(starts.has(c.id)).toBe(false);
    }
  });

  it('splits stone evenly across the basins plus the contested pass', () => {
    const regions = byResource('stone').map((c) => c.region).sort();
    expect(regions).toEqual(['north', 'pass', 'south']);
  });

  it('puts each basin\'s stone one county short of the pass', () => {
    // Stone sitting adjacent to the chokepoint is what makes the pass worth
    // fighting over rather than merely worth walking through.
    for (const c of byResource('stone')) {
      if (c.region === 'pass') continue;
      expect(ix.neighbours.get(c.id)).toContain(countyId('ironthroat'));
    }
  });

  it('covers every resource somewhere on the map', () => {
    const present = new Set(ALDERMARCH.counties.map((c) => c.resource));
    expect([...present].sort()).toEqual(['cows', 'gold', 'ore', 'stone', 'wheat', 'wood']);
  });
});

describe('Aldermarch — starting balance', () => {
  const startDefs = ALDERMARCH.starts.map((s) => {
    const def = ix.countyById.get(s.county);
    if (!def) throw new Error(`start references unknown county ${s.county}`);
    return def;
  });

  it('gives every seat an identically-sized food-producing capital', () => {
    expect(new Set(startDefs.map((c) => c.size))).toEqual(new Set([4]));
    expect(new Set(startDefs.map((c) => c.resource))).toEqual(new Set(['wheat']));
    expect(new Set(startDefs.map((c) => c.terrain))).toEqual(new Set(['open']));
  });

  it('puts two seats in each basin', () => {
    const byRegion = startDefs.reduce<Record<string, number>>((acc, c) => {
      acc[c.region] = (acc[c.region] ?? 0) + 1;
      return acc;
    }, {});
    expect(byRegion).toEqual({ north: 2, south: 2 });
  });

  it('never starts two seats adjacent to each other', () => {
    const startIds = ALDERMARCH.starts.map((s) => s.county);
    for (const a of startIds) {
      for (const b of startIds) {
        if (a === b) continue;
        expect(ix.neighbours.get(a)).not.toContain(b);
      }
    }
  });

  it('gives every seat the same number of counties within early reach', () => {
    // Equal opportunity to expand in the opening turns; if one seat can reach
    // more neutral ground cheaply, that seat is simply better.
    const counts = ALDERMARCH.starts.map(
      (s) => reachableFrom(ix, s.county, 6).size,
    );
    expect(new Set(counts).size).toBe(1);
  });

  it('gives every seat the same neighbour count and terrain mix in reach', () => {
    // Two seats can sit the same distance from the pass and still be unequal if
    // one of them is walled in by rough ground. Compare the actual terrain each
    // seat can touch, not just how far it can walk.
    const profiles = ALDERMARCH.starts.map((s) => {
      const reach = [...reachableFrom(ix, s.county, 6).keys()];
      const terrains = reach
        .map((c) => ix.countyById.get(c)!.terrain)
        .sort()
        .join(',');
      return `${(ix.neighbours.get(s.county) ?? []).length}|${terrains}`;
    });
    expect(new Set(profiles).size).toBe(1);
  });

  it('places no seat closer to the pass than another', () => {
    const distances = ALDERMARCH.starts.map((s) => {
      const reach = reachableFrom(ix, s.county, 999);
      return reach.get(countyId('ironthroat'));
    });
    expect(new Set(distances).size).toBe(1);
  });
});

describe('Aldermarch — movement', () => {
  it('orders costs road < open field < rough ground < the pass', () => {
    // Cost is a property of the terrain being ENTERED, so each of these is
    // named by its destination. Note the road pair must be a declared road —
    // picking any edge between two open counties on the spine would silently
    // be testing the road discount instead of open-field cost.
    const road = moveCost(ix, countyId('duncarrow'), countyId('ironthroat'));
    const open = moveCost(ix, countyId('auldbarrow'), countyId('hollowmere'));
    const forest = moveCost(ix, countyId('hollowmere'), countyId('auldbarrow'));
    const pass = moveCost(ix, countyId('blackrush'), countyId('ironthroat'));

    expect(road).toBeLessThan(open);
    expect(open).toBeLessThan(forest);
    expect(forest).toBeLessThan(pass);
  });

  it('reports an infinite cost between non-adjacent counties', () => {
    expect(moveCost(ix, countyId('hollowmere'), countyId('stonecleft'))).toBe(Infinity);
  });

  it('declares every road between genuinely adjacent counties', () => {
    for (const b of ALDERMARCH.borders.filter((x) => x.road)) {
      expect(ix.neighbours.get(b.a)).toContain(b.b);
    }
  });
});

describe('Aldermarch — geometry', () => {
  it('keeps every polygon inside the declared coordinate space', () => {
    for (const c of ALDERMARCH.counties) {
      for (const p of c.shape) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(ALDERMARCH.width);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(ALDERMARCH.height);
      }
    }
  });

  it('gives every county a polygon with enough vertices to be a real shape', () => {
    for (const c of ALDERMARCH.counties) {
      expect(c.shape.length).toBeGreaterThanOrEqual(8);
    }
  });

  it('shares exact vertices between adjacent counties, so borders do not gap', () => {
    // The generator guarantees this via a keyed vertex cache. If a hand-edit
    // ever breaks it, the map renders with hairline slivers between counties —
    // this catches that at test time instead of on someone's phone.
    const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;
    for (const b of ALDERMARCH.borders) {
      const a = ix.countyById.get(b.a)!;
      const other = ix.countyById.get(b.b)!;
      const shared = new Set(a.shape.map(key));
      const overlap = other.shape.filter((p) => shared.has(key(p)));
      expect(overlap.length).toBeGreaterThanOrEqual(2);
    }
  });
});
